"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EvalBadge } from "./eval-badge";
import { Explain } from "./explain";
import { buildCoverage } from "@/lib/coverage";
import { firstName } from "@/lib/seed";
import { useHasHydrated, useKb } from "@/lib/store";
import type { CoverageCell, HandoverPack, Topic } from "@/lib/types";
import { TOPIC_LABELS, TOPICS } from "@/lib/types";

export function CoverageView() {
  const hydrated = useHasHydrated();
  const { people, records } = useKb();
  const [selected, setSelected] = useState<CoverageCell | null>(null);
  const [outId, setOutId] = useState<string | null>(null);
  const resolvedOut = outId ?? people[0]?.id ?? "";
  const [weeks, setWeeks] = useState<1 | 2>(1);
  const [pack, setPack] = useState<HandoverPack | null>(null);
  const [busy, setBusy] = useState(false);

  const cells = useMemo(
    () => buildCoverage(people, records),
    [people, records],
  );

  async function handover() {
    if (!resolvedOut) return;
    setBusy(true);
    try {
      const res = await fetch("/api/handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: resolvedOut,
          durationWeeks: weeks,
          people,
          records,
        }),
      });
      if (res.ok) setPack((await res.json()) as HandoverPack);
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) {
    return <div className="p-6 text-muted">Loading coverage…</div>;
  }

  if (people.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted">
        Empty shop. Reset demo on Knowledge to load FastTrack Dispatch.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-medium tracking-tight">Coverage</h1>
          <p className="mt-1 text-[12.5px] text-muted">
            Who would break the shop this week.{" "}
            <Explain term="Ring">
              Sole holder — only this person has a filed record on that topic.
            </Explain>{" "}
            means sole holder.{" "}
            <Explain term="Dot">
              The cell has a live dispute or at least one stale record.
            </Explain>{" "}
            is a dispute or stale record.
          </p>
        </div>
        <EvalBadge />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-faint">
              <th className="px-3 py-2 font-medium">Topic</th>
              {people.map((p) => (
                <th key={p.id} className="px-3 py-2 font-medium">
                  {firstName(p.name)}
                  <div className="text-[10px] font-normal text-faint">
                    {p.role}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TOPICS.map((topic) => (
              <tr key={topic} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-muted">{TOPIC_LABELS[topic]}</td>
                {people.map((p) => {
                  const cell = cells.find(
                    (c) => c.personId === p.id && c.topic === topic,
                  );
                  if (!cell) return <td key={p.id} />;
                  const active =
                    selected?.personId === cell.personId &&
                    selected.topic === cell.topic;
                  return (
                    <td key={p.id} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelected(cell)}
                        className={`relative flex h-9 w-full items-center justify-center rounded-md border text-[11px] ${
                          active
                            ? "border-accent bg-accent-soft"
                            : "border-transparent bg-background hover:border-border"
                        }`}
                      >
                        {cell.soleHolder ? (
                          <span
                            className="absolute inset-1 rounded-full border border-accent/70"
                            aria-hidden
                          />
                        ) : null}
                        <span className="capitalize text-muted">
                          {cell.density}
                        </span>
                        {cell.hasDispute || cell.stale ? (
                          <span
                            className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                              cell.hasDispute ? "bg-warning" : "bg-danger"
                            }`}
                          />
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <CellPanel cell={selected} />
      ) : (
        <p className="mt-3 text-[12px] text-faint">
          Click a cell to open the panel, then Capture.
        </p>
      )}

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-[13px] font-medium">If X is out</h2>
        <p className="mt-1 text-[12px] text-muted">
          Builds a handover pack from filed coverage — 1 or 2 weeks.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={resolvedOut}
            onChange={(e) => setOutId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[12px]"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) as 1 | 2)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[12px]"
          >
            <option value={1}>1 week</option>
            <option value={2}>2 weeks</option>
          </select>
          <button
            type="button"
            onClick={() => void handover()}
            disabled={busy}
            className="rounded-md bg-accent px-3 py-1 text-[12px] text-white disabled:opacity-40"
          >
            {busy ? "Building…" : "Build pack"}
          </button>
        </div>
        {pack ? (
          <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-muted">
            {pack.briefing}
          </pre>
        ) : null}
      </section>
    </div>
  );
}

function CellPanel({ cell }: { cell: CoverageCell }) {
  const { people } = useKb();
  const person = people.find((p) => p.id === cell.personId);
  if (!person) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <p className="text-[13px] font-medium">
        {firstName(person.name)} · {TOPIC_LABELS[cell.topic as Topic]}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {cell.density}
        {cell.soleHolder ? " · sole holder" : ""}
        {cell.hasDispute ? " · dispute" : ""}
        {cell.stale ? " · stale" : ""}
        {cell.recordIds.length
          ? ` · ${cell.recordIds.join(", ")}`
          : " · nothing filed"}
      </p>
      <Link
        href={`/capture?person=${person.id}&topic=${cell.topic}`}
        className="mt-3 inline-flex rounded-md bg-accent px-3 py-1 text-[12px] text-white"
      >
        Capture this cell
      </Link>
    </div>
  );
}
