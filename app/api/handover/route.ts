import { NextResponse } from "next/server";
import { handoverFallback } from "@/lib/fallback";
import { completeJson } from "@/lib/llm";
import { HANDOVER_SYSTEM } from "@/lib/prompts";
import { buildHandover } from "@/lib/handover";
import type { HandoverPack, KnowledgeRecord, Person } from "@/lib/types";

type Body = {
  personId?: string;
  durationWeeks?: 1 | 2;
  people?: Person[];
  records?: KnowledgeRecord[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const personId = body.personId ?? "";
  const durationWeeks = body.durationWeeks === 2 ? 2 : 1;
  const people = body.people ?? [];
  const records = body.records ?? [];
  const pack = handoverFallback(people, records, personId, durationWeeks);
  if (!pack) {
    return NextResponse.json({ error: "unknown person" }, { status: 400 });
  }

  const structured = buildHandover(people, records, personId, durationWeeks);
  const llm = await completeJson<{ briefing: string }>(
    HANDOVER_SYSTEM,
    JSON.stringify(
      {
        person: pack.personName,
        durationWeeks,
        soleTopics: pack.soleTopics,
        whoCovers: pack.whoCovers,
        disputes: pack.disputes,
        stale: pack.stale,
        records: records.filter((r) => r.sourcePersonId === personId),
      },
      null,
      2,
    ),
  );

  const result: HandoverPack = {
    ...pack,
    briefing: llm?.briefing?.trim() || structured?.briefing || pack.briefing,
  };
  return NextResponse.json(result);
}
