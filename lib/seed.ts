import seed from "@/data/seed.json";
import type { KnowledgeRecord, Person } from "./types";
import { DEMO_BUSINESS } from "./types";

export const SEED_PEOPLE = seed.people as Person[];
export const SEED_RECORDS = seed.records as KnowledgeRecord[];
export const SEED_BUSINESS = seed.businessName || DEMO_BUSINESS;

export function cloneSeed() {
  return {
    businessName: SEED_BUSINESS,
    people: SEED_PEOPLE.map((p) => ({ ...p })),
    records: SEED_RECORDS.map((r) => ({
      ...r,
      peopleMentioned: [...r.peopleMentioned],
    })),
  };
}

export function personById(
  people: Person[],
  id: string,
): Person | undefined {
  return people.find((p) => p.id === id);
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function nextRecordId(records: KnowledgeRecord[]): string {
  let max = 0;
  for (const r of records) {
    const n = Number(r.id.replace(/^KR-/, ""));
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `KR-${String(max + 1).padStart(3, "0")}`;
}
