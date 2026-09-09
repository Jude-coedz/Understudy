import type { Freshness, KnowledgeRecord, Topic } from "./types";
import { daysAgo } from "./time";

const FAST: Topic[] = ["delivery-routes", "customer-handling", "warnings"];
const SLOW: Topic[] = ["office", "generator"];

export function freshnessOf(
  record: KnowledgeRecord,
  now = Date.now(),
): Freshness {
  const days = daysAgo(record.capturedAt, now);
  if (FAST.includes(record.topic)) {
    if (days < 14) return "fresh";
    if (days < 42) return "aging";
    return "stale";
  }
  if (SLOW.includes(record.topic)) {
    if (days < 90) return "fresh";
    if (days < 240) return "aging";
    return "stale";
  }
  if (days < 28) return "fresh";
  if (days < 84) return "aging";
  return "stale";
}

export function isStale(record: KnowledgeRecord, now = Date.now()): boolean {
  return freshnessOf(record, now) === "stale";
}

export function isAgingOrStale(
  record: KnowledgeRecord,
  now = Date.now(),
): boolean {
  const f = freshnessOf(record, now);
  return f === "aging" || f === "stale";
}

export function freshnessLabel(freshness: Freshness): string {
  if (freshness === "fresh") return "Fresh";
  if (freshness === "aging") return "Aging";
  return "Stale";
}
