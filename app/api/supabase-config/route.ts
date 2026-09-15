import { NextResponse } from "next/server";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function cloudflareBindings() {
  try {
    const cloudflare = await import("cloudflare:workers");
    return (cloudflare.env || {}) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export async function GET() {
  const bindings = await cloudflareBindings();

  const url =
    text(bindings.SUPABASE_URL) ||
    text(bindings.NEXT_PUBLIC_SUPABASE_URL) ||
    text(process.env.SUPABASE_URL) ||
    text(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const publishableKey =
    text(bindings.SUPABASE_PUBLISHABLE_KEY) ||
    text(bindings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    text(bindings.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    text(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    text(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    text(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return NextResponse.json({
    configured: Boolean(url && publishableKey),
    url,
    publishableKey,
    source:
      url && publishableKey
        ? text(bindings.SUPABASE_URL) || text(bindings.NEXT_PUBLIC_SUPABASE_URL)
          ? "cloudflare-bindings"
          : "process-env"
        : "missing",
  });
}
