import { buildCoverage } from "./coverage";
import { findDisputes } from "./disputes";
import { isStale } from "./freshness";
import { firstName, personById } from "./seed";
import type {
  Gap,
  KnowledgeRecord,
  Person,
  Topic,
} from "./types";
import { TOPIC_LABELS, TOPICS } from "./types";

function thinWhy(record: KnowledgeRecord): boolean {
  return record.reasoning.trim().length < 40;
}

export function findGaps(
  people: Person[],
  records: KnowledgeRecord[],
  focus?: { personId?: string; topic?: Topic | null },
): Gap[] {
  const gaps: Gap[] = [];
  const cells = buildCoverage(people, records);

  for (const d of findDisputes(records)) {
    const [a, b] = d.records;
    const personA = personById(people, a.sourcePersonId);
    const personB = personById(people, b.sourcePersonId);
    if (!personA || !personB) continue;
    const askPerson =
      focus?.personId &&
      (focus.personId === personA.id || focus.personId === personB.id)
        ? focus.personId
        : personB.id;
    const ask = personById(people, askPerson)!;
    const other = ask.id === personA.id ? personB : personA;
    gaps.push({
      kind: "disagreement",
      personId: ask.id,
      topic: a.topic,
      relatedRecordIds: [a.id, b.id],
      askingBecause: `${firstName(personA.name)} and ${firstName(personB.name)} disagree about ${d.subject}. Filing both sides; we still need when each rule applies.`,
      suggestedQuestion: `${firstName(ask.name)}, ${firstName(other.name)} says something different about ${d.subject} and urgent jobs. When is ${d.subject} actually OK, and when should we still call the other rider?`,
    });
  }

  for (const person of people) {
    if (focus?.personId && person.id !== focus.personId) continue;
    for (const topic of TOPICS) {
      if (focus?.topic && topic !== focus.topic) continue;
      const cell = cells.find(
        (c) => c.personId === person.id && c.topic === topic,
      );
      if (!cell || cell.density !== "missing") continue;
      const anyone = cells.some(
        (c) => c.topic === topic && c.density !== "missing",
      );
      gaps.push({
        kind: "missing",
        personId: person.id,
        topic,
        relatedRecordIds: [],
        askingBecause: anyone
          ? `${firstName(person.name)} has nothing on ${TOPIC_LABELS[topic].toLowerCase()}, and someone else already does. A second voice would show whether they agree.`
          : `Nobody has filed ${TOPIC_LABELS[topic].toLowerCase()} from ${firstName(person.name)}. If they are out this week, that shelf is empty.`,
        suggestedQuestion: `${firstName(person.name)}, what should a new person know about ${TOPIC_LABELS[topic].toLowerCase()} here — the rule, and why it is that way?`,
      });
    }
  }

  for (const record of records) {
    if (focus?.personId && record.sourcePersonId !== focus.personId) continue;
    if (focus?.topic && record.topic !== focus.topic) continue;
    if (!thinWhy(record)) continue;
    const person = personById(people, record.sourcePersonId);
    if (!person) continue;
    gaps.push({
      kind: "thin-why",
      personId: person.id,
      topic: record.topic,
      relatedRecordIds: [record.id],
      askingBecause: `${record.id} has a rule but almost no why. We file incidents and names, not a tidy wiki line.`,
      suggestedQuestion: `${firstName(person.name)}, you said “${record.knowledge}” — what happened that made that the rule?`,
    });
  }

  for (const record of records) {
    if (focus?.personId && record.sourcePersonId !== focus.personId) continue;
    if (focus?.topic && record.topic !== focus.topic) continue;
    if (!isStale(record)) continue;
    const person = personById(people, record.sourcePersonId);
    if (!person) continue;
    gaps.push({
      kind: "stale",
      personId: person.id,
      topic: record.topic,
      relatedRecordIds: [record.id],
      askingBecause: `${record.id} on ${TOPIC_LABELS[record.topic].toLowerCase()} has aged. Routes, customers, and warnings go stale faster than office or generator rules.`,
      suggestedQuestion: `${firstName(person.name)}, is this still true: “${record.knowledge}”? If not, what changed?`,
    });
  }

  const rank: Record<Gap["kind"], number> = {
    disagreement: 0,
    missing: 1,
    "thin-why": 2,
    stale: 3,
  };
  gaps.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return gaps;
}

export function nextGap(
  people: Person[],
  records: KnowledgeRecord[],
  focus?: { personId?: string; topic?: Topic | null },
): Gap | null {
  return findGaps(people, records, focus)[0] ?? null;
}
