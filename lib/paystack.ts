import "server-only";

import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

type InitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type VerifyResponse = {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
    customer?: { email?: string; customer_code?: string };
    subscription?: {
      subscription_code?: string;
      email_token?: string;
    };
    plan?: { plan_code?: string } | string | null;
    metadata?: Record<string, unknown> | string | null;
  };
};

function getSecretKey() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return secret;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & { status?: boolean; message?: string };
  if (!response.ok || payload.status === false) {
    throw new Error(payload.message || `Paystack request failed (${response.status})`);
  }
  return payload;
}

export async function initializeSubscription(input: {
  email: string;
  planCode: string;
  callbackUrl: string;
  reference: string;
  metadata: Record<string, unknown>;
}) {
  return paystackFetch<InitializeResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      plan: input.planCode,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify(input.metadata),
    }),
  });
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<VerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" }
  );
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const digest = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");

  const expected = Buffer.from(digest, "utf8");
  const actual = Buffer.from(signature, "utf8");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function webhookEventKey(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}
