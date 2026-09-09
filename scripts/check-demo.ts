import { runExtractionEval } from "../lib/eval";
import { findDisputes } from "../lib/disputes";
import { askFallback } from "../lib/fallback";
import { SEED_PEOPLE, SEED_RECORDS } from "../lib/seed";

const evalResult = runExtractionEval();
console.log("eval", `${evalResult.passed}/${evalResult.total}`);
for (const r of evalResult.results) {
  if (!r.pass) console.log(" FAIL", r.id, r.missed, r.draft.topic, r.draft.peopleMentioned);
}

const disputes = findDisputes(SEED_RECORDS);
console.log(
  "disputes",
  disputes.map((d) => `${d.subject}:${d.records[0].id}/${d.records[1].id}`),
);

const briefing = askFallback(
  "Who shouldn’t we use for urgent jobs?",
  SEED_RECORDS,
  SEED_PEOPLE,
);
console.log("ask unknown?", briefing.unknown);
console.log("ask has KR-006", briefing.prose.includes("KR-006") || briefing.disputes.some((d) => d.sides.some((s) => s.recordId === "KR-006")));
console.log("ask has KR-021", briefing.prose.includes("KR-021") || briefing.disputes.some((d) => d.sides.some((s) => s.recordId === "KR-021")));

const gap = askFallback("What time does the Apapa ferry leave?", SEED_RECORDS, SEED_PEOPLE);
console.log("gap unknown?", gap.unknown, gap.gap?.slice(0, 80));

if (evalResult.passed !== 8) process.exit(1);
if (!disputes.some((d) => d.subject === "Musa")) process.exit(1);
if (briefing.unknown) process.exit(1);
if (!gap.unknown) {
  console.error("expected gap for Apapa ferry");
  process.exit(1);
}
