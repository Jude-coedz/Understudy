import { NextResponse } from "next/server";
import { completeJsonDetailed, modelRuntimeInfo } from "@/lib/llm";

type HealthPayload = { ok?: boolean };

export async function GET() {
  const runtime = modelRuntimeInfo();

  if (!runtime.configured) {
    return NextResponse.json({
      configured: false,
      model: runtime.model,
      live: false,
      status: { state: "fallback", reason: "not_configured", retryable: false },
    });
  }

  const probe = await completeJsonDetailed<HealthPayload>(
    "You are a health check. Return JSON only.",
    'Return exactly {"ok":true}.',
    {
      timeoutMs: 8_000,
      maxOutputTokens: 32,
      temperature: 0,
    },
  );

  return NextResponse.json({
    configured: true,
    model: runtime.model,
    live: probe.status.state === "ok" && probe.data?.ok === true,
    status: probe.status,
  });
}
