import { NextResponse } from "next/server";
import { extractFallback } from "@/lib/fallback";
import { completeJson } from "@/lib/llm";
import { EXTRACT_SYSTEM } from "@/lib/prompts";
import type { ExtractionDraft, Topic } from "@/lib/types";
import { TOPICS } from "@/lib/types";

function asDraft(raw: ExtractionDraft | null, answer: string): ExtractionDraft {
  const fallback = extractFallback(answer);
  if (!raw) return fallback;
  const topic = TOPICS.includes(raw.topic as Topic)
    ? (raw.topic as Topic)
    : fallback.topic;
  return {
    knowledge: (raw.knowledge || "").trim() || fallback.knowledge,
    // Speaker's original why — never let the model paraphrase Pidgin away.
    reasoning: answer.trim(),
    topic,
    peopleMentioned: Array.isArray(raw.peopleMentioned)
      ? raw.peopleMentioned
      : fallback.peopleMentioned,
    confidence:
      raw.confidence === "high" ||
      raw.confidence === "medium" ||
      raw.confidence === "low"
        ? raw.confidence
        : fallback.confidence,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { answer?: string };
  const answer = (body.answer ?? "").trim();
  if (!answer) {
    return NextResponse.json(
      { error: "answer required" },
      { status: 400 },
    );
  }
  const llm = await completeJson<ExtractionDraft>(
    EXTRACT_SYSTEM,
    `Answer:\n${answer}`,
  );
  return NextResponse.json(asDraft(llm, answer));
}
