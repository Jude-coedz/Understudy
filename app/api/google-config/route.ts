import { NextResponse } from "next/server";

export async function GET() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";
  const apiKey =
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ||
    "";

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
