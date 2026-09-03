import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getImageGenerationAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: "Authentication required" };
  }

  if (process.env.ENABLE_REAL_IMAGE_GENERATION !== "true") {
    return {
      ok: false as const,
      status: 503,
      error: "Real image generation is disabled in this environment",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false as const, status: 503, error: "Image provider is not configured" };
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!subscription) {
    return { ok: false as const, status: 402, error: "An active subscription is required" };
  }

  return { ok: true as const, user, apiKey };
}
