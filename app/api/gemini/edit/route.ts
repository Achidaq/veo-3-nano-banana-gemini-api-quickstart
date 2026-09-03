import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getImageGenerationAccess } from "@/lib/generation/image-access";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 10;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(req: Request) {
  const access = await getImageGenerationAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const prompt = String(form.get("prompt") || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const contents: (
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    )[] = [{ text: prompt }];

    const imageFiles = form
      .getAll("imageFiles")
      .filter((value): value is File => value instanceof File)
      .slice(0, MAX_IMAGES);

    for (const imageFile of imageFiles) {
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "An image exceeds the 20MB limit" }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
        return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
      }
      const buf = await imageFile.arrayBuffer();
      contents.push({
        inlineData: {
          mimeType: imageFile.type,
          data: Buffer.from(buf).toString("base64"),
        },
      });
    }

    const singleImageFile = form.get("imageFile");
    if (singleImageFile instanceof File && contents.length === 1) {
      if (
        singleImageFile.size > MAX_IMAGE_BYTES ||
        !ALLOWED_IMAGE_TYPES.has(singleImageFile.type)
      ) {
        return NextResponse.json({ error: "Invalid image upload" }, { status: 400 });
      }
      const buf = await singleImageFile.arrayBuffer();
      contents.push({
        inlineData: {
          mimeType: singleImageFile.type,
          data: Buffer.from(buf).toString("base64"),
        },
      });
    }

    const imageBase64 = String(form.get("imageBase64") || "") || undefined;
    const imageMimeType = String(form.get("imageMimeType") || "") || undefined;
    if (imageBase64 && contents.length === 1) {
      const mimeType = imageMimeType || "image/png";
      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
      }
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      if (Buffer.byteLength(cleaned, "base64") > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Image exceeds the 20MB limit" }, { status: 400 });
      }
      contents.push({ inlineData: { mimeType, data: cleaned } });
    }

    if (contents.length < 2) {
      return NextResponse.json({ error: "No images provided for editing" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: access.apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents,
    });

    let imageData: string | undefined;
    let responseMimeType = "image/png";
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        responseMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      return NextResponse.json({ error: "No image generated" }, { status: 502 });
    }

    return NextResponse.json({
      image: {
        imageBytes: imageData,
        mimeType: responseMimeType,
      },
    });
  } catch (error) {
    console.error("Error editing image with Gemini", error);
    return NextResponse.json({ error: "Failed to edit image" }, { status: 500 });
  }
}
