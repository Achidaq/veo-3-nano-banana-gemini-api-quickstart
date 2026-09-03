import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOWNLOAD_HOSTS = new Set(["generativelanguage.googleapis.com"]);

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
    const body = (await req.json()) as {
      uri?: string;
      file?: { uri?: string };
    };
    const uri = body.uri || body.file?.uri;

    if (!uri) {
      return NextResponse.json({ error: "Missing file uri" }, { status: 400 });
    }

    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(uri);
    } catch {
      return NextResponse.json({ error: "Invalid file uri" }, { status: 400 });
    }

    if (
      upstreamUrl.protocol !== "https:" ||
      !ALLOWED_DOWNLOAD_HOSTS.has(upstreamUrl.hostname)
    ) {
      return NextResponse.json({ error: "Unapproved video download host" }, { status: 400 });
    }

    const resp = await fetch(upstreamUrl, {
      headers: {
        "x-goog-api-key": apiKey,
        Accept: "video/mp4,application/octet-stream;q=0.9,*/*;q=0.1",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!resp.ok) {
      console.error("Veo upstream download failed", resp.status, resp.statusText);
      return NextResponse.json({ error: "Upstream video download failed" }, { status: 502 });
    }

    if (resp.body) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          "Content-Type": resp.headers.get("content-type") || "video/mp4",
          "Content-Disposition": 'inline; filename="veo_video.mp4"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const arrayBuffer = await resp.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": resp.headers.get("content-type") || "video/mp4",
        "Content-Disposition": 'inline; filename="veo_video.mp4"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error downloading Veo video", error);
    return NextResponse.json({ error: "Failed to download video" }, { status: 500 });
  }
}
