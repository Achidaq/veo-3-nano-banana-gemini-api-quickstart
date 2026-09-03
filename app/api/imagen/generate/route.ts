import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getImageGenerationAccess } from "@/lib/generation/image-access";

export async function POST(req: Request) {
  const access = await getImageGenerationAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = (await req.json()) as { prompt?: string };
    const prompt = body.prompt?.trim() || "";

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: access.apiKey });
    const resp = await ai.models.generateImages({
      model: "imagen-4.0-fast-generate-001",
      prompt,
      config: {
        aspectRatio: "16:9",
      },
    });

    const image = resp.generatedImages?.[0]?.image;
    if (!image?.imageBytes) {
      return NextResponse.json({ error: "No image returned" }, { status: 502 });
    }

    return NextResponse.json({
      image: {
        imageBytes: image.imageBytes,
        mimeType: image.mimeType || "image/png",
      },
    });
  } catch (error) {
    console.error("Error generating image with Imagen", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
