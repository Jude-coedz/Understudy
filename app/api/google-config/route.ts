import { NextResponse } from "next/server";

function runtimeEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export async function GET() {
  const clientId =
    runtimeEnv("GOOGLE_CLIENT_ID") ||
    runtimeEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  const apiKey =
    runtimeEnv("GOOGLE_API_KEY") ||
    runtimeEnv("NEXT_PUBLIC_GOOGLE_API_KEY");

  return NextResponse.json(
    {
      configured: Boolean(clientId && apiKey),
      clientId,
      apiKey,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
