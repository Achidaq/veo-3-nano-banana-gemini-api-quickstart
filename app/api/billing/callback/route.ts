import { NextResponse } from "next/server";
import { fulfillSuccessfulTransaction } from "@/lib/billing/fulfillment";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(new URL("/billing?payment=missing-reference", url.origin));
  }

  try {
    await fulfillSuccessfulTransaction(reference);
    return NextResponse.redirect(
      new URL(`/billing?payment=success&reference=${encodeURIComponent(reference)}`, url.origin)
    );
  } catch (error) {
    console.error("Paystack callback verification failed", error);
    return NextResponse.redirect(
      new URL(`/billing?payment=verification-failed&reference=${encodeURIComponent(reference)}`, url.origin)
    );
  }
}
