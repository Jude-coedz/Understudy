"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Explain } from "./explain";
import type { Briefing } from "@/lib/types";
import { firstName } from "@/lib/seed";

const CHIP = /\{\{(KR-\d+)\|([^|]+)\|([^}]+)\}\}/g;

function renderProse(prose: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(CHIP.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(prose))) {
    if (m.index > last) {
      nodes.push(<span key={`t-${key++}`}>{prose.slice(last, m.index)}</span>);
    }
    const id = m[1];
    const who = m[2];
    const when = m[3];
    nodes.push(
      <Link
        key={`c-${key++}`}
        href={`/#${id}`}
        className="mx-0.5 inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] text-muted hover:border-accent hover:text-foreground"
      >
        {id} · {who} · {when}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < prose.length) {
    nodes.push(<span key={`t-${key++}`}>{prose.slice(last)}</span>);
  }
  return nodes;
}

export function BriefingView({ briefing }: { briefing: Briefing }) {
  if (briefing.unknown) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6">
        <p className="text-[11px] uppercase tracking-wide text-faint">
          <Explain term="Gap">
            Nothing filed answers this. Capture it from someone who does the
            work. The product must not guess.
          </Explain>
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {briefing.gap}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-4 text-[13.5px] leading-relaxed">
        {briefing.prose.split("\n\n").map((para, i) => (
          <p key={i} className={i ? "mt-3" : undefined}>
            {renderProse(para)}
          </p>
        ))}
      </div>
      {briefing.disputes.map((d) => (
        <div
          key={d.subject}
          className="rounded-lg border border-warning/30 bg-card p-4"
        >
          <p className="text-[11px] uppercase tracking-wide text-warning">
            Both sides · {d.subject}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.sides.map((side) => (
              <div key={side.recordId} className="rounded-md border border-border p-3">
                <p className="text-[11px] text-muted">
                  {firstName(side.personName)} · {side.recordId}
                </p>
                <p className="mt-1 text-[13px]">{side.knowledge}</p>
                <p className="mt-2 text-[12px] text-muted">{side.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
