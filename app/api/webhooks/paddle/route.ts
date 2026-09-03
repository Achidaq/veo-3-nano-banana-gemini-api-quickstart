import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unmarshalPaddleWebhook } from "@/lib/paddle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");

  let event: Awaited<ReturnType<typeof unmarshalPaddleWebhook>>;
  try {
    event = await unmarshalPaddleWebhook(rawBody, signature);
  } catch (error) {
    console.error("Invalid Paddle webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const admin = createAdminClient();
  const eventKey = event.eventId;

  const { error: insertError } = await admin.from("webhook_events").insert({
    provider: "paddle",
    event_key: eventKey,
    event_type: event.eventType,
    payload: JSON.parse(rawBody),
  });

  if (insertError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (insertError) {
    console.error("Could not persist Paddle webhook", insertError);
    return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
  }

  try {
    // Fulfillment is intentionally added only after the billing migration is live
    // and the Paddle sandbox price IDs are mapped to local plans. Until then,
    // verified events are persisted for replay-safe testing without granting credits.
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("provider", "paddle")
      .eq("event_key", eventKey);

    return NextResponse.json({ received: true, eventType: event.eventType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Paddle webhook processing failed", error);

    await admin
      .from("webhook_events")
      .update({ processing_error: message })
      .eq("provider", "paddle")
      .eq("event_key", eventKey);

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
