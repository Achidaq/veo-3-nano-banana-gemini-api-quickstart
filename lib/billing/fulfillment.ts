import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

export async function fulfillSuccessfulTransaction(reference: string) {
  const verified = await verifyTransaction(reference);
  const tx = verified.data;

  if (tx.status !== "success" || tx.reference !== reference) {
    throw new Error("Paystack transaction is not successful");
  }

  const admin = createAdminClient();
  let { data: payment } = await admin
    .from("payments")
    .select("id,user_id,subscription_id,provider_reference,amount_minor,currency,status")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!payment) {
    const metadata = parseMetadata(tx.metadata);
    const userId = typeof metadata.user_id === "string" ? metadata.user_id : null;
    const planId = typeof metadata.plan_id === "string" ? metadata.plan_id : null;
    const subscriptionId =
      typeof metadata.subscription_id === "string" ? metadata.subscription_id : null;

    if (!userId || !planId || !subscriptionId) {
      throw new Error("Unknown Paystack transaction");
    }

    const { data: plan } = await admin
      .from("plans")
      .select("id,price_minor,currency")
      .eq("id", planId)
      .single();

    if (!plan) throw new Error("Unknown plan for transaction");

    const { data: created, error } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        provider: "paystack",
        provider_reference: reference,
        provider_transaction_id: tx.id,
        amount_minor: tx.amount,
        currency: tx.currency,
        status: "pending",
        metadata: { recovered_from_paystack: true, plan_id: planId },
      })
      .select("id,user_id,subscription_id,provider_reference,amount_minor,currency,status")
      .single();

    if (error || !created) throw new Error("Could not recover Paystack payment");
    payment = created;
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id,user_id,plan_id,status")
    .eq("id", payment.subscription_id)
    .single();

  if (!subscription) throw new Error("Subscription not found for payment");

  const { data: plan } = await admin
    .from("plans")
    .select("id,price_minor,currency,monthly_credits,paystack_plan_code")
    .eq("id", subscription.plan_id)
    .single();

  if (!plan) throw new Error("Subscription plan not found");

  if (Number(tx.amount) !== Number(plan.price_minor)) {
    throw new Error("Paystack amount does not match plan price");
  }
  if (String(tx.currency).toUpperCase() !== String(plan.currency).toUpperCase()) {
    throw new Error("Paystack currency does not match plan currency");
  }

  const customerCode = tx.customer?.customer_code || null;
  const subscriptionCode = tx.subscription?.subscription_code || null;
  const emailToken = tx.subscription?.email_token || null;

  const { error: paymentUpdateError } = await admin
    .from("payments")
    .update({
      status: "success",
      provider_transaction_id: tx.id,
      paid_at: tx.paid_at || new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (paymentUpdateError) throw new Error("Could not mark payment successful");

  const subscriptionPatch: Record<string, unknown> = {
    status: "active",
    provider_customer_code: customerCode,
  };
  if (subscriptionCode) subscriptionPatch.provider_subscription_code = subscriptionCode;
  if (emailToken) subscriptionPatch.provider_email_token = emailToken;

  const { error: subscriptionUpdateError } = await admin
    .from("subscriptions")
    .update(subscriptionPatch)
    .eq("id", subscription.id);

  if (subscriptionUpdateError) throw new Error("Could not activate subscription");

  const { error: creditError } = await admin.rpc("grant_credits", {
    p_user_id: subscription.user_id,
    p_amount: plan.monthly_credits,
    p_idempotency_key: `paystack:${reference}:credits`,
    p_entry_type: "subscription_grant",
    p_payment_id: payment.id,
    p_metadata: { plan_id: plan.id, provider_reference: reference },
  });

  if (creditError) throw new Error(`Could not grant subscription credits: ${creditError.message}`);

  return {
    paymentId: payment.id,
    subscriptionId: subscription.id,
    userId: subscription.user_id,
    planId: plan.id,
    creditsGranted: plan.monthly_credits,
  };
}
