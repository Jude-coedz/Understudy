import { NextResponse } from "next/server";
import { completeJsonDetailed } from "@/lib/llm";
import {
  normalizeWholeRoleSynthesis,
  WHOLE_ROLE_SYNTHESIS_SYSTEM,
  type WholeRoleModelOutput,
  type WholeRoleSynthesisInput,
  type WholeRoleSource,
} from "@/lib/role-evidence";

const MAX_COMBINED_CHARS = 120_000;
const MAX_SOURCE_CHARS = 18_000;

function validSource(source: WholeRoleSource) {
  return Boolean(
    source?.id &&
      source?.title &&
      source?.provider &&
      source?.kind &&
      source?.text?.trim(),
  );
}

function compactSources(sources: WholeRoleSource[]) {
  let remaining = MAX_COMBINED_CHARS;
  const result: WholeRoleSource[] = [];

  for (const source of sources) {
    if (remaining <= 0) break;
    const allowance = Math.min(MAX_SOURCE_CHARS, remaining);
    const text = source.text.trim().slice(0, allowance);
    if (!text) continue;
    result.push({ ...source, text });
    remaining -= text.length;
  }

  return result;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<WholeRoleSynthesisInput>;
  const transition = body.transition;
  const rawSources = Array.isArray(body.sources) ? body.sources : [];

  if (
    !transition?.person ||
    !transition?.role ||
    !transition?.department ||
    !transition?.successor ||
    !transition?.targetDate ||
    !rawSources.length ||
    !rawSources.every(validSource)
  ) {
    return NextResponse.json(
      { error: "transition context and at least one valid evidence source are required" },
      { status: 400 },
    );
  }

  const sources = compactSources(rawSources as WholeRoleSource[]);
  if (!sources.length) {
    return NextResponse.json({ error: "no readable evidence was supplied" }, { status: 400 });
  }

  const input: WholeRoleSynthesisInput = {
    transition,
    sources,
    current: body.current,
  };

  const model = await completeJsonDetailed<WholeRoleModelOutput>(
    WHOLE_ROLE_SYNTHESIS_SYSTEM,
    `TRANSITION\n${JSON.stringify(transition, null, 2)}\n\nEVIDENCE_SET\n${JSON.stringify(
      sources.map((source) => ({
        id: source.id,
        title: source.title,
        kind: source.kind,
        provider: source.provider,
        confidence: source.confidence,
        text: source.text,
      })),
      null,
      2,
    )}`,
  );

  return NextResponse.json({
    result: normalizeWholeRoleSynthesis(input, model.data, model.status.state === "ok"),
    usedModel: model.status.state === "ok",
    modelStatus: model.status,
    truncated: rawSources.reduce((sum, source) => sum + (source.text?.length ?? 0), 0) > MAX_COMBINED_CHARS,
  });
}
