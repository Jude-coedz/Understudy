"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { cloneSeed, nextRecordId, SEED_RECORDS } from "./seed";
import type { ExtractionDraft, KnowledgeRecord, Person } from "./types";
import { DEMO_BUSINESS } from "./types";

export type KbState = {
  businessName: string;
  people: Person[];
  records: KnowledgeRecord[];
  resetDemo: () => void;
  newBusiness: () => void;
  addRecord: (
    sourcePersonId: string,
    draft: ExtractionDraft,
  ) => KnowledgeRecord;
};

type Persisted = Pick<KbState, "businessName" | "people" | "records">;

function injectMusaUpdate(records: KnowledgeRecord[]): KnowledgeRecord[] {
  const has006 = records.some((r) => r.id === "KR-006");
  const has021 = records.some((r) => r.id === "KR-021");
  if (has006 && !has021) {
    const kr021 = SEED_RECORDS.find((r) => r.id === "KR-021");
    if (kr021) {
      return [
        ...records,
        { ...kr021, peopleMentioned: [...kr021.peopleMentioned] },
      ];
    }
  }
  return records;
}

export const useKb = create<KbState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      resetDemo: () => set(cloneSeed()),
      newBusiness: () =>
        set({
          businessName: "New business",
          people: [],
          records: [],
        }),
      addRecord: (sourcePersonId, draft) => {
        const rec: KnowledgeRecord = {
          id: nextRecordId(get().records),
          knowledge: draft.knowledge.trim(),
          reasoning: draft.reasoning.trim(),
          topic: draft.topic,
          peopleMentioned: [...draft.peopleMentioned],
          sourcePersonId,
          capturedAt: new Date().toISOString(),
          confidence: draft.confidence,
        };
        set({ records: [...get().records, rec] });
        return rec;
      },
    }),
    {
      name: "understudy-kb",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({
        businessName: s.businessName,
        people: s.people,
        records: s.records,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Persisted>;
        return {
          ...current,
          ...p,
          businessName: p.businessName || current.businessName,
          people: p.people?.length ? p.people : current.people,
          records: injectMusaUpdate(p.records ?? current.records),
        };
      },
      migrate: (persisted): Persisted => {
        const s = (persisted ?? {}) as Partial<Persisted>;
        const seed = cloneSeed();
        const records = injectMusaUpdate(s.records ?? []);
        return {
          businessName: s.businessName || DEMO_BUSINESS,
          people: s.people?.length ? s.people : seed.people,
          records,
        };
      },
    },
  ),
);

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => setHydrated(true);
    if (useKb.persist.hasHydrated()) done();
    return useKb.persist.onFinishHydration(done);
  }, []);
  return hydrated;
}
