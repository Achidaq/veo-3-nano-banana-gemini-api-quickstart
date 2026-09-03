import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoteVeoCredits } from "@/lib/generation/pricing";

const ACTIVE_GENERATION_STATES = [
  "reserved",
  "submitting",
  "processing",
  "uploading",
];

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (process.env.ENABLE_REAL_VEO_GENERATION !== "true") {
    return NextResponse.json(
      { error: "Real Veo generation is disabled in this environment" },
      { status: 503 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Veo provider is not configured" }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const prompt = String(form.get("prompt") || "").trim();
  const model = String(form.get("model") || "veo-3.1-lite-generate-preview");
  const resolution = String(form.get("resolution") || "720p");
  const durationSeconds = Number(form.get("durationSeconds") || 8);
  const negativePrompt = String(form.get("negativePrompt") || "").trim() || undefined;
  const aspectRatio = String(form.get("aspectRatio") || "16:9");
  const projectId = String(form.get("projectId") || "").trim() || null;

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }
  if (aspectRatio !== "16:9" && aspectRatio !== "9:16") {
    return NextResponse.json({ error: "Unsupported aspect ratio" }, { status: 400 });
  }

  let quote;
  try {
    quote = quoteVeoCredits({ model, resolution, durationSeconds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid generation settings" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id,plan_id,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: "An active subscription is required" }, { status: 402 });
  }

  const { data: plan } = await admin
    .from("plans")
    .select("max_concurrent_generations")
    .eq("id", subscription.plan_id)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Subscription plan is unavailable" }, { status: 503 });
  }

  const { count: activeCount } = await admin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ACTIVE_GENERATION_STATES);

  if ((activeCount || 0) >= plan.max_concurrent_generations) {
    return NextResponse.json(
      { error: "Concurrent generation limit reached" },
      { status: 429 }
    );
  }

  const { data: generation, error: generationError } = await admin
    .from("generations")
    .insert({
      user_id: user.id,
      project_id: projectId,
      kind: "video",
      model: quote.model,
      prompt,
      status: "queued",
      metadata: {
        aspect_ratio: aspectRatio,
        resolution: quote.resolution,
        duration_seconds: quote.durationSeconds,
        credits_quoted: quote.credits,
      },
    })
    .select("id")
    .single();

  if (generationError || !generation) {
    return NextResponse.json({ error: "Could not create generation" }, { status: 400 });
  }

  let creditsReserved = false;

  try {
    const { error: reserveError } = await admin.rpc("reserve_generation_credits", {
      p_user_id: user.id,
      p_generation_id: generation.id,
      p_amount: quote.credits,
      p_idempotency_key: `generation:${generation.id}:reserve`,
      p_metadata: {
        model: quote.model,
        resolution: quote.resolution,
        duration_seconds: quote.durationSeconds,
      },
    });

    if (reserveError) {
      await admin
        .from("generations")
        .update({ status: "failed", error_message: reserveError.message })
        .eq("id", generation.id);

      const status = reserveError.message.toLowerCase().includes("insufficient") ? 402 : 500;
      return NextResponse.json({ error: reserveError.message }, { status });
    }

    creditsReserved = true;

    await Promise.all([
      admin.from("generations").update({ status: "submitting" }).eq("id", generation.id),
      admin.from("generation_costs").insert({
        generation_id: generation.id,
        user_id: user.id,
        provider: "google",
        provider_model: quote.model,
        duration_seconds: quote.durationSeconds,
        estimated_cost_usd: quote.estimatedProviderCostUsd,
        credits_reserved: quote.credits,
      }),
    ]);

    const imageFile = form.get("imageFile");
    const imageBase64 = String(form.get("imageBase64") || "") || undefined;
    const imageMimeType = String(form.get("imageMimeType") || "") || undefined;
    let image: { imageBytes: string; mimeType: string } | undefined;

    if (imageFile && imageFile instanceof File) {
      if (imageFile.size > 20 * 1024 * 1024) {
        throw new Error("Reference image exceeds the 20MB Veo limit");
      }
      const buf = await imageFile.arrayBuffer();
      image = {
        imageBytes: Buffer.from(buf).toString("base64"),
        mimeType: imageFile.type || "image/png",
      };
    } else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      image = { imageBytes: cleaned, mimeType: imageMimeType || "image/png" };
    }

    const ai = new GoogleGenAI({ apiKey });
    const operation = await ai.models.generateVideos({
      model: quote.model,
      prompt,
      ...(image ? { image } : {}),
      config: {
        aspectRatio,
        resolution: quote.resolution,
        durationSeconds: quote.durationSeconds,
        ...(negativePrompt ? { negativePrompt } : {}),
      },
    });

    const name = (operation as unknown as { name?: string }).name;
    if (!name) throw new Error("Veo did not return an operation name");

    await admin
      .from("generations")
      .update({ status: "processing", operation_name: name, error_message: null })
      .eq("id", generation.id);

    return NextResponse.json({
      name,
      generationId: generation.id,
      creditsReserved: quote.credits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start generation";

    if (creditsReserved) {
      await admin.rpc("release_generation_credits", {
        p_user_id: user.id,
        p_generation_id: generation.id,
        p_amount: quote.credits,
        p_idempotency_key: `generation:${generation.id}:start-failure-release`,
        p_metadata: { reason: "provider_start_failure" },
      });
    }

    await admin
      .from("generations")
      .update({ status: "failed", error_message: message })
      .eq("id", generation.id);

    console.error("Error starting Veo generation", error);
    return NextResponse.json({ error: "Failed to start generation" }, { status: 500 });
  }
}
