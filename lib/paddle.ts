import "server-only";

import { Environment, Paddle } from "@paddle/paddle-node-sdk";

export function createPaddleClient() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY is not configured");

  return new Paddle(apiKey, {
    environment:
      process.env.PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
  });
}

export async function createCheckoutTransaction(input: {
  priceId: string;
  userId: string;
  planId: string;
  subscriptionId: string;
}) {
  const paddle = createPaddleClient();

  return paddle.transactions.create({
    items: [{ priceId: input.priceId, quantity: 1 }],
    collectionMode: "automatic",
    customData: {
      user_id: input.userId,
      plan_id: input.planId,
      local_subscription_id: input.subscriptionId,
    },
  });
}

export async function unmarshalPaddleWebhook(rawBody: string, signature: string | null) {
  if (!signature) throw new Error("Missing Paddle-Signature header");

  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("PADDLE_WEBHOOK_SECRET is not configured");

  const paddle = createPaddleClient();
  return paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
}
