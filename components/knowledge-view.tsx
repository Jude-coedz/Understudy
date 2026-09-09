"use client";

import { useMemo, useState } from "react";
import { KnowledgeCard } from "./knowledge-card";
import { Explain } from "./explain";
import { findDisputes } from "@/lib/disputes";
import { isAgingOrStale } from "@/lib/freshness";
import { firstName } from "@/lib/seed";
import { useHasHydrated, useKb } from "@/lib/store";
import type { Confidence, Topic } from "@/lib/types";
import { TOPIC_LABELS, TOPICS } from "@/lib/types";

type Attention = "all" | "disputes" | "aging";

export function KnowledgeView() {
  const hydrated = useHasHydrated();
  const { businessName, people, records, resetDemo, newBusiness } = useKb();
  const [topic, setTopic] = useState<Topic | "all">("all");
  const [personId, setPersonId] = useState<string>("all");
  const [confidence, setConfidence] = useState<Confidence | "all">("all");
  const [attention, setAttention] = useState<Attention>("all");

  const disputedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const d of findDisputes(records)) {
      ids.add(d.records[0].id);
      ids.add(d.records[1].id);
    }
    return ids;
  }, [records]);

  const filtered = useMemo(() => {
    return records
      .filter((r) => (topic === "all" ? true : r.topic === topic))
      .filter((r) => (personId === "all" ? true : r.sourcePersonId === personId))
      .filter((r) => (confidence === "all" ? true : r.confidence === confidence))
      .filter((r) => {
        if (attention === "disputes") return disputedIds.has(r.id);
        if (attention === "aging") return isAgingOrStale(r);
        return true;
      })
      .slice()
      .sort(
        (a, b) =>
          new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      );
  }, [records, topic, personId, confidence, attention, disputedIds]);

  if (!hydrated) {
    return <div className="p-6 text-muted">Loading knowledge…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-medium tracking-tight">
            {businessName}
          </h1>
          <p className="mt-1 max-w-xl text-[12.5px] text-muted">
            Operational knowledge, filed with the{" "}
            <Explain term="why">
              The speaker’s original reasoning — Pidgin, incidents, names. Not a
              tidy wiki paraphrase.
            </Explain>
            . {records.length} record{records.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => newBusiness()}
            className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted hover:text-foreground"
          >
            New business
          </button>
          <button
            type="button"
            onClick={() => resetDemo()}
            className="rounded-md bg-accent px-2.5 py-1 text-[12px] text-white"
          >
            Reset demo
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as Topic | "all")}
          className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        >
          <option value="all">All topics</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {TOPIC_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        >
          <option value="all">All people</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {firstName(p.name)}
            </option>
          ))}
        </select>
        <select
          value={confidence}
          onChange={(e) => setConfidence(e.target.value as Confidence | "all")}
          className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        >
          <option value="all">Any confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={attention}
          onChange={(e) => setAttention(e.target.value as Attention)}
          className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
        >
          <option value="all">All records</option>
          <option value="disputes">Disputes</option>
          <option value="aging">Aging / stale</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted">
          {records.length === 0
            ? "Empty store. Reset demo to load FastTrack Dispatch, or capture from Coverage after adding people."
            : "No records match these filters."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <div key={r.id} id={r.id}>
              <KnowledgeCard record={r} records={records} people={people} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
