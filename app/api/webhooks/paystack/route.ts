import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyWebhookSignature,
  webhookEventKey,
} from "@/lib/paystack";
import { fulfillSuccessfulTransaction } from "@/lib/billing/fulfillment";

type PaystackEvent = {
  event?: string;
  data?: Record<string, any>;
};

async function reconcileSubscriptionCreate(data: Record<string, any>) {
  const admin = createAdminClient();
  const subscriptionCode = data.subscription_code as string | undefined;
  const emailToken = data.email_token as string | undefined;
  const customerCode = data.customer?.customer_code as string | undefined;
  const customerEmail = data.customer?.email as string | undefined;
  const planCode =
    (data.plan?.plan_code as string | undefined) ||
    (typeof data.plan === "string" ? data.plan : undefined);

  if (!subscriptionCode) return;

  const { data: byCode } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider_subscription_code", subscriptionCode)
    .maybeSingle();

  let localId = byCode?.id as string | undefined;

  if (!localId && customerEmail && planCode) {
    const { data: pending } = await admin
      .from("subscriptions")
      .select("id")
      .eq("billing_email", customerEmail)
      .eq("provider_plan_code", planCode)
      .in("status", ["pending", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    localId = pending?.id as string | undefined;
  }

  if (!localId) return;

  await admin
    .from("subscriptions")
    .update({
      status: "active",
      provider_subscription_code: subscriptionCode,
      provider_email_token: emailToken || null,
      provider_customer_code: customerCode || null,
    })
    .eq("id", localId);
}

async function markSubscription(data: Record<string, any>, status: "cancelled" | "past_due") {
  const code =
    (data.subscription?.subscription_code as string | undefined) ||
    (data.subscription_code as string | undefined);
  if (!code) return;

  const admin = createAdminClient();
  const patch: Record<string, unknown> = { status };
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

  await admin
    .from("subscriptions")
    .update(patch)
    .eq("provider_subscription_code", code);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventKey = webhookEventKey(rawBody);
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("webhook_events").insert({
    provider: "paystack",
    event_key: eventKey,
    event_type: event.event || "unknown",
    payload: event,
  });

  if (insertError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (insertError) {
    console.error("Could not record Paystack webhook", insertError);
    return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
  }

  try {
    const data = event.data || {};

    switch (event.event) {
      case "charge.success": {
        const reference = data.reference as string | undefined;
        if (!reference) throw new Error("charge.success missing reference");
        await fulfillSuccessfulTransaction(reference);
        break;
      }
      case "subscription.create":
        await reconcileSubscriptionCreate(data);
        break;
      case "subscription.disable":
        await markSubscription(data, "cancelled");
        break;
      case "invoice.payment_failed":
        await markSubscription(data, "past_due");
        break;
      default:
        break;
    }

    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("provider", "paystack")
      .eq("event_key", eventKey);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Paystack webhook processing failed", error);
    await admin
      .from("webhook_events")
      .update({ processing_error: message })
      .eq("provider", "paystack")
      .eq("event_key", eventKey);

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
