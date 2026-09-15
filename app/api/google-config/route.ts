import { NextResponse } from "next/server";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  let bindings: Record<string, unknown> = {};

  try {
    const cloudflare = await import("cloudflare:workers");
    bindings = (cloudflare.env || {}) as Record<string, unknown>;
  } catch {
    // Local Next.js validation does not run inside workerd. The process.env
    // fallback keeps local development working while production uses bindings.
  }

  const clientId =
    clean(bindings.GOOGLE_CLIENT_ID) ||
    clean(bindings.NEXT_PUBLIC_GOOGLE_CLIENT_ID) ||
    clean(process.env.GOOGLE_CLIENT_ID) ||
    clean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const apiKey =
    clean(bindings.GOOGLE_API_KEY) ||
    clean(bindings.NEXT_PUBLIC_GOOGLE_API_KEY) ||
    clean(process.env.GOOGLE_API_KEY) ||
    clean(process.env.NEXT_PUBLIC_GOOGLE_API_KEY);

  return NextResponse.json(
    {
      configured: Boolean(clientId && apiKey),
      clientId,
      apiKey,
      source: clientId && apiKey ? (Object.keys(bindings).length ? "cloudflare-bindings" : "process-env") : "missing",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
