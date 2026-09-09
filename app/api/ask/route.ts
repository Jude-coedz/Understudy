import { NextResponse } from "next/server";
import { askFallback } from "@/lib/fallback";
import { completeJson } from "@/lib/llm";
import { ASK_SYSTEM } from "@/lib/prompts";
import { firstName, personById } from "@/lib/seed";
import { relativeTime } from "@/lib/time";
import type { Briefing, KnowledgeRecord, Person } from "@/lib/types";

type AskBody = {
  question?: string;
  records?: KnowledgeRecord[];
  people?: Person[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as AskBody;
  const question = (body.question ?? "").trim();
  const records = body.records ?? [];
  const people = body.people ?? [];
  const fallback = askFallback(question, records, people);

  const catalog = records.map((r) => {
    const p = personById(people, r.sourcePersonId);
    return {
      id: r.id,
      knowledge: r.knowledge,
      reasoning: r.reasoning,
      topic: r.topic,
      source: firstName(p?.name ?? r.sourcePersonId),
      peopleMentioned: r.peopleMentioned,
      when: relativeTime(r.capturedAt),
    };
  });

  const llm = await completeJson<
    Pick<Briefing, "prose" | "unknown" | "gap" | "disputes">
  >(
    ASK_SYSTEM,
    `Question:\n${question}\n\nRecords:\n${JSON.stringify(catalog, null, 2)}`,
  );

  if (!llm) return NextResponse.json(fallback);
  // Local gap/dispute detection is product code. The model must not guess
  // into an unknown, hide a filed disagreement, or invent when nothing matches.
  if (Boolean(llm.unknown) !== fallback.unknown) {
    return NextResponse.json(fallback);
  }
  const llmDisputes = Array.isArray(llm.disputes) ? llm.disputes : [];
  if (fallback.disputes.length > llmDisputes.length) {
    return NextResponse.json({
      ...fallback,
      prose: llm.unknown ? fallback.prose : llm.prose || fallback.prose,
    });
  }

  return NextResponse.json({
    question,
    prose: llm.unknown ? "" : llm.prose ?? fallback.prose,
    unknown: Boolean(llm.unknown),
    gap: llm.unknown ? llm.gap || fallback.gap : llm.gap ?? null,
    disputes: llmDisputes,
  } satisfies Briefing);
}
