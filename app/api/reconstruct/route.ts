import { NextResponse } from "next/server";
import { completeJsonDetailed } from "@/lib/llm";
import {
  normalizeReconstruction,
  RECONSTRUCTION_SYSTEM,
  type ModelReconstruction,
  type ReconstructionInput,
} from "@/lib/v2-reconstruction";

function validKind(kind: unknown) {
  return (
    kind === "document" ||
    kind === "github" ||
    kind === "ai-context" ||
    kind === "interview"
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ReconstructionInput>;
  const transition = body.transition;
  const source = body.source;

  if (
    !transition?.person ||
    !transition?.role ||
    !transition?.department ||
    !transition?.successor ||
    !transition?.targetDate ||
    !source?.title ||
    !source?.provider ||
    !validKind(source.kind) ||
    !source?.text?.trim()
  ) {
    return NextResponse.json(
      { error: "transition context and non-empty source text are required" },
      { status: 400 },
    );
  }

  if (source.text.length > 60_000) {
    return NextResponse.json(
      { error: "source is too large for this build; keep imports under 60,000 characters" },
      { status: 413 },
    );
  }

  const input = body as ReconstructionInput;
  const interviewContext = source.kind === "interview"
    ? `\n\nOPEN_GAPS\n${JSON.stringify(input.openGaps ?? [], null, 2)}\n\nPRIMARY_QUESTION\n${input.primaryQuestion ?? ""}`
    : "";

  const model = await completeJsonDetailed<ModelReconstruction>(
    RECONSTRUCTION_SYSTEM,
    `TRANSITION\n${JSON.stringify(transition, null, 2)}\n\nSOURCE\n${JSON.stringify(
      {
        title: source.title,
        kind: source.kind,
        provider: source.provider,
        text: source.text,
      },
      null,
      2,
    )}${interviewContext}`,
  );

  return NextResponse.json({
    result: normalizeReconstruction(input, model.data),
    usedModel: model.status.state === "ok",
    modelStatus: model.status,
  });
}
