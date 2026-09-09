import { buildCoverage, soleHolderTopics } from "./coverage";
import { findDisputes } from "./disputes";
import { isStale } from "./freshness";
import { firstName, personById } from "./seed";
import { relativeTime } from "./time";
import type {
  HandoverPack,
  KnowledgeRecord,
  Person,
  Topic,
} from "./types";
import { TOPIC_LABELS } from "./types";

export function buildHandover(
  people: Person[],
  records: KnowledgeRecord[],
  personId: string,
  durationWeeks: 1 | 2,
): HandoverPack | null {
  const person = personById(people, personId);
  if (!person) return null;
  const cells = buildCoverage(people, records);
  const soleTopics = soleHolderTopics(personId, cells);
  const whoCovers = cells
    .filter((c) => c.personId === personId && c.density !== "missing")
    .map((c) => {
      const others = people
        .filter((p) => {
          if (p.id === personId) return false;
          const cell = cells.find(
            (x) => x.personId === p.id && x.topic === c.topic,
          );
          return cell && cell.density !== "missing";
        })
        .map((p) => firstName(p.name));
      return { topic: c.topic as Topic, people: others };
    });

  const disputes = findDisputes(
    records.filter((r) => r.sourcePersonId === personId),
  ).map((d) => ({
    subject: d.subject,
    summary: `${d.records[0].id} vs ${d.records[1].id} on ${d.subject}`,
  }));
  // Include disputes they're a party to even if the other record isn't theirs
  const allDisputes = findDisputes(records).filter((d) =>
    d.records.some((r) => r.sourcePersonId === personId),
  );
  const disputeLines = allDisputes.map((d) => {
    const [a, b] = d.records;
    const pa = personById(people, a.sourcePersonId);
    const pb = personById(people, b.sourcePersonId);
    return {
      subject: d.subject,
      summary: `${firstName(pa?.name ?? a.sourcePersonId)} (${a.id}): ${a.knowledge} — ${firstName(pb?.name ?? b.sourcePersonId)} (${b.id}): ${b.knowledge}`,
    };
  });

  const stale = records
    .filter((r) => r.sourcePersonId === personId && isStale(r))
    .map((r) => ({
      recordId: r.id,
      topic: r.topic,
      knowledge: r.knowledge,
    }));

  const who = firstName(person.name);
  const lines: string[] = [];
  lines.push(
    `If ${who} is out for ${durationWeeks} week${durationWeeks === 1 ? "" : "s"}`,
  );
  lines.push("");
  if (soleTopics.length) {
    lines.push("Would break the shop (sole holder):");
    for (const t of soleTopics) {
      lines.push(
        `- ${TOPIC_LABELS[t]}: nobody else has a filed record. Capture someone before ${who} leaves.`,
      );
    }
    lines.push("");
  }
  const shared = whoCovers.filter((w) => w.people.length > 0);
  if (shared.length) {
    lines.push("Covered by someone else:");
    for (const w of shared) {
      lines.push(`- ${TOPIC_LABELS[w.topic]}: ${w.people.join(", ")}`);
    }
    lines.push("");
  }
  if (disputeLines.length) {
    lines.push("Live disagreements — keep both sides:");
    for (const d of disputeLines) {
      lines.push(`- ${d.subject}: ${d.summary}`);
    }
    lines.push("");
  }
  if (stale.length) {
    lines.push("Aging while they are gone:");
    for (const s of stale) {
      const rec = records.find((r) => r.id === s.recordId);
      lines.push(
        `- ${s.recordId} (${TOPIC_LABELS[s.topic]}, ${rec ? relativeTime(rec.capturedAt) : ""}): ${s.knowledge}`,
      );
    }
    lines.push("");
  }
  const mine = records.filter((r) => r.sourcePersonId === personId);
  lines.push("What they actually know (do not summarise away the why):");
  for (const r of mine) {
    lines.push(`- ${r.id} [${TOPIC_LABELS[r.topic]}]: ${r.knowledge}`);
    lines.push(`  Why: ${r.reasoning}`);
  }

  return {
    personId,
    personName: person.name,
    durationWeeks,
    soleTopics,
    whoCovers,
    disputes: disputeLines.length ? disputeLines : disputes,
    stale,
    briefing: lines.join("\n"),
  };
}
