import { POST as extract } from "../app/api/extract/route";
import { POST as ask } from "../app/api/ask/route";
import { POST as nextQuestion } from "../app/api/next-question/route";
import { POST as handover } from "../app/api/handover/route";
import { SEED_PEOPLE, SEED_RECORDS } from "../lib/seed";

async function post(handler: (req: Request) => Promise<Response>, body: unknown) {
  const req = new Request("http://127.0.0.1/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await handler(req);
  const json = await res.json();
  if (!res.ok) {
    console.error("fail", res.status, json);
    process.exit(1);
  }
  return json;
}

async function main() {
  const draft = await post(extract, {
    answer:
      "Do not use Musa for urgent jobs, use Chidi. Sallah weekend he disappeared with two hospital runs.",
  });
  console.log("extract topic", draft.topic, "people", draft.peopleMentioned.join(","));
  if (draft.topic !== "warnings") process.exit(1);
  if (!draft.reasoning.includes("Sallah")) process.exit(1);

  const briefing = await post(ask, {
    question: "Who shouldn’t we use for urgent jobs?",
    people: SEED_PEOPLE,
    records: SEED_RECORDS,
  });
  const blob = JSON.stringify(briefing);
  console.log("ask unknown", briefing.unknown);
  if (briefing.unknown) process.exit(1);
  if (!blob.includes("KR-006") || !blob.includes("KR-021")) {
    console.error(briefing);
    process.exit(1);
  }

  const gap = await post(ask, {
    question: "What time does the Apapa ferry leave?",
    people: SEED_PEOPLE,
    records: SEED_RECORDS,
  });
  console.log("gap unknown", gap.unknown);
  if (!gap.unknown) process.exit(1);

  const q = await post(nextQuestion, {
    personId: "bola",
    topic: "warnings",
    people: SEED_PEOPLE,
    records: SEED_RECORDS,
  });
  console.log("next-q", q.gapKind, q.askingBecause.slice(0, 80));
  if (!q.question || !q.askingBecause) process.exit(1);

  const pack = await post(handover, {
    personId: "emeka",
    durationWeeks: 1,
    people: SEED_PEOPLE,
    records: SEED_RECORDS,
  });
  console.log("handover sole", pack.soleTopics);
  if (!pack.briefing.includes("Emeka")) process.exit(1);

  console.log("api ok");
}

main();
