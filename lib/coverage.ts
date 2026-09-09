import { findDisputes } from "./disputes";
import { isStale } from "./freshness";
import { firstName } from "./seed";
import type {
  CoverageCell,
  CoverageDensity,
  KnowledgeRecord,
  Person,
  Topic,
} from "./types";
import { TOPICS } from "./types";

export function densityFor(count: number): CoverageDensity {
  if (count <= 0) return "missing";
  if (count === 1) return "thin";
  return "dense";
}

export function buildCoverage(
  people: Person[],
  records: KnowledgeRecord[],
  now = Date.now(),
): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const topic of TOPICS) {
    const onTopic = records.filter((r) => r.topic === topic);
    const holders = new Set(onTopic.map((r) => r.sourcePersonId));
    const disputes = findDisputes(onTopic);
    const disputedIds = new Set(
      disputes.flatMap((d) => d.records.map((r) => r.id)),
    );
    for (const person of people) {
      const mine = onTopic.filter((r) => r.sourcePersonId === person.id);
      cells.push({
        personId: person.id,
        topic,
        density: densityFor(mine.length),
        soleHolder: mine.length > 0 && holders.size === 1,
        hasDispute: mine.some((r) => disputedIds.has(r.id)),
        stale: mine.some((r) => isStale(r, now)),
        recordIds: mine.map((r) => r.id),
      });
    }
  }
  return cells;
}

export function soleHolderTopics(
  personId: string,
  cells: CoverageCell[],
): Topic[] {
  return cells
    .filter((c) => c.personId === personId && c.soleHolder)
    .map((c) => c.topic);
}

export function coverageSummary(cells: CoverageCell[], people: Person[]): string {
  const missing = cells.filter((c) => c.density === "missing").length;
  const rings = cells.filter((c) => c.soleHolder).length;
  const names = people.map((p) => firstName(p.name)).join(", ");
  return `${names}: ${missing} empty cells, ${rings} sole-holder topics.`;
}
