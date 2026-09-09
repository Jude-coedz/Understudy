import { NextResponse } from "next/server";
import { nextQuestionFallback } from "@/lib/fallback";
import { completeJson } from "@/lib/llm";
import { NEXT_QUESTION_SYSTEM } from "@/lib/prompts";
import { findGaps } from "@/lib/gaps";
import type { CaptureQuestion, KnowledgeRecord, Person, Topic } from "@/lib/types";
import { TOPICS } from "@/lib/types";

type Body = {
  personId?: string;
  topic?: Topic | null;
  people?: Person[];
  records?: KnowledgeRecord[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const personId = body.personId ?? "";
  const topic =
    body.topic && TOPICS.includes(body.topic) ? body.topic : null;
  const people = body.people ?? [];
  const records = body.records ?? [];
  const fallback = nextQuestionFallback(people, records, personId, topic);

  const gaps = findGaps(people, records, { personId, topic }).slice(0, 8);
  const llm = await completeJson<CaptureQuestion>(
    NEXT_QUESTION_SYSTEM,
    JSON.stringify({ personId, topic, gaps }, null, 2),
  );
  if (!llm?.question) return NextResponse.json(fallback);

  return NextResponse.json({
    question: llm.question,
    askingBecause: llm.askingBecause || fallback.askingBecause,
    personId: llm.personId || fallback.personId,
    topic: llm.topic === undefined ? fallback.topic : llm.topic,
    gapKind: llm.gapKind || fallback.gapKind,
  } satisfies CaptureQuestion);
}
