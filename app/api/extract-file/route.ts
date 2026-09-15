import { NextResponse } from "next/server";
import { extractDocumentTextWithGemini } from "@/lib/llm";

const MAX_BYTES = 5 * 1024 * 1024;
const GEMINI_MIME_TYPES = new Set(["application/pdf"]);

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const value = form.get("file");
  if (!(value instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!GEMINI_MIME_TYPES.has(value.type)) {
    return NextResponse.json({ error: `Unsupported server-extracted file type: ${value.type || "unknown"}.` }, { status: 415 });
  }
  if (value.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF files must be 5 MB or smaller in this build." }, { status: 413 });
  }

  const buffer = new Uint8Array(await value.arrayBuffer());
  const text = await extractDocumentTextWithGemini({
    mimeType: value.type,
    base64: toBase64(buffer),
    filename: value.name,
  });

  if (!text) {
    return NextResponse.json(
      { error: "Understudy could not extract this PDF because Gemini was unavailable. DOCX, PPTX, XLSX and text-based formats still work without Gemini." },
      { status: 503 },
    );
  }

  return NextResponse.json({ text: text.slice(0, 100_000), method: "gemini-document" });
}
