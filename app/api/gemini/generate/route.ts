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
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: prompt,
    });

    let imageData: string | undefined;
    let imageMimeType = "image/png";

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        imageMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: "No image generated" }, { status: 502 });
    }

    return NextResponse.json({
      image: {
        imageBytes: imageData,
        mimeType: imageMimeType,
      },
    });
  } catch (error) {
    console.error("Error generating image with Gemini", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
