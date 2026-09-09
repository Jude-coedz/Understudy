"use client";

import Link from "next/link";
import { ConfidenceDots } from "./confidence";
import { Explain } from "./explain";
import { disputesFor } from "@/lib/disputes";
import { freshnessLabel, freshnessOf } from "@/lib/freshness";
import { firstName, personById } from "@/lib/seed";
import { relativeTime } from "@/lib/time";
import type { KnowledgeRecord, Person } from "@/lib/types";
import { TOPIC_LABELS } from "@/lib/types";

export function KnowledgeCard({
  record,
  records,
  people,
}: {
  record: KnowledgeRecord;
  records: KnowledgeRecord[];
  people: Person[];
}) {
  const source = personById(people, record.sourcePersonId);
  const fresh = freshnessOf(record);
  const disputes = disputesFor(record, records);

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="font-mono text-[10.5px] text-faint">{record.id}</span>
        <span>{TOPIC_LABELS[record.topic]}</span>
        <span>
          {source ? firstName(source.name) : record.sourcePersonId} ·{" "}
          {relativeTime(record.capturedAt)}
        </span>
        <ConfidenceDots value={record.confidence} />
        <span
          className={
            fresh === "stale"
              ? "text-danger"
              : fresh === "aging"
                ? "text-warning"
                : "text-ok"
          }
        >
          <Explain term={freshnessLabel(fresh)}>
            Routes, customers, and warnings age faster than office or generator
            rules. Aging is a prompt to recapture, not to delete.
          </Explain>
        </span>
        {disputes.length > 0 ? (
          <span className="text-warning">
            <Explain term="Dispute">
              Same named person, opposite polarity in the knowledge line. Both
              sides stay filed. Ask shows both.
            </Explain>
          </span>
        ) : null}
      </div>

      <p className="text-[13.5px] leading-snug text-foreground">{record.knowledge}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
        <span className="mr-1.5 font-medium text-faint">Why</span>
        {record.reasoning}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-faint">
        {record.peopleMentioned.length > 0 ? (
          <span>Mentions {record.peopleMentioned.join(", ")}</span>
        ) : null}
        {disputes.map((d) => {
          const other = d.records.find((r) => r.id !== record.id);
          if (!other) return null;
          const otherPerson = personById(people, other.sourcePersonId);
          return (
            <Link
              key={`${d.subject}-${other.id}`}
              href={`#${other.id}`}
              className="rounded border border-border px-1.5 py-0.5 text-warning hover:border-warning"
            >
              vs {other.id} · {otherPerson ? firstName(otherPerson.name) : other.sourcePersonId} on {d.subject}
            </Link>
          );
        })}
      </div>
    </article>
  );
}
