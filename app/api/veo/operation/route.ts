import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OperationSnapshot = {
  done?: boolean;
  error?: unknown;
  response?: {
    generatedVideos?: unknown[];
  };
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Veo provider is not configured" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as { name?: string };
    const name = body.name;

    if (!name) {
      return NextResponse.json({ error: "Missing operation name" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: generation } = await admin
      .from("generations")
      .select("id,user_id,status")
      .eq("operation_name", name)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const fresh = await ai.operations.getVideosOperation({
      operation: { name } as unknown as never,
    });

    const snapshot = fresh as unknown as OperationSnapshot;

    if (snapshot.done && !["completed", "failed", "cancelled"].includes(generation.status)) {
      const { data: cost } = await admin
        .from("generation_costs")
        .select("credits_reserved")
        .eq("generation_id", generation.id)
        .maybeSingle();

      const creditsReserved = cost?.credits_reserved || 0;
      const hasVideo = Boolean(snapshot.response?.generatedVideos?.length);

      if (snapshot.error || !hasVideo) {
        if (creditsReserved > 0) {
          await admin.rpc("release_generation_credits", {
            p_user_id: user.id,
            p_generation_id: generation.id,
            p_amount: creditsReserved,
            p_idempotency_key: `generation:${generation.id}:provider-failure-release`,
            p_metadata: { reason: "provider_generation_failure" },
          });
        }

        await admin
          .from("generations")
          .update({
            status: "failed",
            error_message: "Veo did not produce a video",
          })
          .eq("id", generation.id);
      } else {
        if (creditsReserved > 0) {
          const { error: captureError } = await admin.rpc("capture_generation_credits", {
            p_user_id: user.id,
            p_generation_id: generation.id,
            p_amount: creditsReserved,
            p_idempotency_key: `generation:${generation.id}:capture`,
            p_metadata: { reason: "provider_generation_success" },
          });

          if (captureError) {
            console.error("Credit capture failed", captureError);
            return NextResponse.json(
              { error: "Generation completed but credit settlement failed" },
              { status: 500 }
            );
          }

          await admin
            .from("generation_costs")
            .update({ credits_captured: creditsReserved })
            .eq("generation_id", generation.id);
        }

        await admin
          .from("generations")
          .update({ status: "completed", error_message: null })
          .eq("id", generation.id);
      }
    }

    return NextResponse.json(fresh);
  } catch (error) {
    console.error("Error polling Veo operation", error);
    return NextResponse.json({ error: "Failed to poll operation" }, { status: 500 });
  }
}
