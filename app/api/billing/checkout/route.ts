import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initializeSubscription } from "@/lib/paystack";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: string };
    if (!body.planId) {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("id,name,currency,price_minor,monthly_credits,paystack_plan_code,is_active")
      .eq("id", body.planId)
      .eq("is_active", true)
      .single();

    if (planError || !plan?.paystack_plan_code) {
      return NextResponse.json({ error: "Plan is not available for checkout" }, { status: 400 });
    }

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id,status")
      .eq("user_id", user.id)
      .in("status", ["pending", "active", "past_due"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "An active or pending subscription already exists" },
        { status: 409 }
      );
    }

    const reference = `veo_${crypto.randomUUID().replaceAll("-", "")}`;
    const origin = new URL(request.url).origin;

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        status: "pending",
        provider: "paystack",
      })
      .select("id")
      .single();

    if (subscriptionError || !subscription) {
      throw new Error("Could not create pending subscription");
    }

    const { error: paymentError } = await admin.from("payments").insert({
      user_id: user.id,
      subscription_id: subscription.id,
      provider: "paystack",
      provider_reference: reference,
      amount_minor: plan.price_minor,
      currency: plan.currency,
      status: "pending",
      metadata: { plan_id: plan.id },
    });

    if (paymentError) {
      await admin.from("subscriptions").update({ status: "expired" }).eq("id", subscription.id);
      throw new Error("Could not create pending payment");
    }

    try {
      const result = await initializeSubscription({
        email: user.email,
        planCode: plan.paystack_plan_code,
        callbackUrl: `${origin}/api/billing/callback`,
        reference,
        metadata: {
          user_id: user.id,
          plan_id: plan.id,
          subscription_id: subscription.id,
        },
      });

      return NextResponse.json({
        authorizationUrl: result.data.authorization_url,
        reference: result.data.reference,
      });
    } catch (error) {
      await admin.from("payments").update({ status: "failed" }).eq("provider_reference", reference);
      await admin.from("subscriptions").update({ status: "expired" }).eq("id", subscription.id);
      throw error;
    }
  } catch (error) {
    console.error("Checkout initialization failed", error);
    return NextResponse.json({ error: "Could not initialize checkout" }, { status: 500 });
  }
}
