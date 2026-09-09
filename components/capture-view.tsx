"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfidenceDots } from "./confidence";
import { Explain } from "./explain";
import { wouldDispute } from "@/lib/disputes";
import { firstName } from "@/lib/seed";
import { useHasHydrated, useKb } from "@/lib/store";
import type { CaptureQuestion, ExtractionDraft, Topic } from "@/lib/types";
import { TOPIC_LABELS, TOPICS } from "@/lib/types";

const emptyDraft: ExtractionDraft = {
  knowledge: "",
  reasoning: "",
  topic: "office",
  peopleMentioned: [],
  confidence: "medium",
};

export function CaptureView() {
  const hydrated = useHasHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { people, records, addRecord } = useKb();

  const paramPerson = params.get("person") ?? "";
  const paramTopic = params.get("topic");
  const personId = paramPerson || people[0]?.id || "";
  const topic: Topic | "" =
    paramTopic && TOPICS.includes(paramTopic as Topic)
      ? (paramTopic as Topic)
      : "";

  const [question, setQuestion] = useState<CaptureQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState<ExtractionDraft>(emptyDraft);
  const [extracting, setExtracting] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  function go(nextPerson: string, nextTopic: Topic | "") {
    const q = new URLSearchParams();
    if (nextPerson) q.set("person", nextPerson);
    if (nextTopic) q.set("topic", nextTopic);
    const qs = q.toString();
    router.replace(qs ? `/capture?${qs}` : "/capture");
  }

  useEffect(() => {
    if (!hydrated || !personId) return;
    let cancelled = false;
    fetch("/api/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        topic: topic || null,
        people,
        records,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((q: CaptureQuestion | null) => {
        if (!cancelled && q) setQuestion(q);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, personId, topic, people, records]);

  useEffect(() => {
    if (!answer.trim()) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setExtracting(true);
      fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload: unknown) => {
          if (!payload || typeof payload !== "object") return;
          const obj = payload as Record<string, unknown>;
          const nested = obj.draft;
          const draft = (
            nested && typeof nested === "object" ? nested : obj
          ) as ExtractionDraft;
          if (typeof draft.knowledge === "string") setDraft(draft);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
        })
        .finally(() => {
          if (!controller.signal.aborted) setExtracting(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [answer]);

  const warnings = useMemo(
    () => wouldDispute(draft, records),
    [draft, records],
  );

  const person = people.find((p) => p.id === personId);

  function save() {
    if (!personId || !draft.knowledge.trim() || !draft.reasoning.trim()) return;
    const rec = addRecord(personId, draft);
    setSavedId(rec.id);
    setAnswer("");
    setDraft(emptyDraft);
  }

  if (!hydrated) {
    return <div className="p-6 text-muted">Loading capture…</div>;
  }

  if (people.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted">
        Nobody to interview. Reset demo on Knowledge to load FastTrack Dispatch.
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <h1 className="text-[18px] font-medium tracking-tight">Capture</h1>
        <p className="mt-1 text-[12.5px] text-muted">
          Simulated interview — not WhatsApp. Questions come from{" "}
          <Explain term="gaps">
            Missing topic, thin why, disagreement, or stale knowledge. Not a
            survey.
          </Explain>
          .
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={personId}
            onChange={(e) => go(e.target.value, topic)}
            className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={topic}
            onChange={(e) => go(personId, e.target.value as Topic | "")}
            className="rounded-md border border-border bg-card px-2 py-1 text-[12px]"
          >
            <option value="">Any topic (next gap)</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {question ? (
          <div className="mt-5 rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-faint">
              Asking because
            </p>
            <p className="mt-1 text-[12.5px] text-muted">{question.askingBecause}</p>
            <p className="mt-3 text-[14px] leading-snug">{question.question}</p>
          </div>
        ) : null}

        <label className="mt-4 block text-[11px] text-faint">
          {person ? firstName(person.name) : "Speaker"} answers
        </label>
        <textarea
          value={answer}
          onChange={(e) => {
            const v = e.target.value;
            setAnswer(v);
            if (!v.trim()) setDraft(emptyDraft);
          }}
          rows={8}
          placeholder="Keep the incident, the names, the Pidgin."
          className="mt-1 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-relaxed"
        />
      </section>

      <aside className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium">Live extraction</h2>
          <span className="text-[11px] text-faint">
            {extracting ? "Extracting…" : "Edit before save"}
          </span>
        </div>

        <label className="mt-3 block text-[11px] text-faint">Knowledge</label>
        <textarea
          value={draft.knowledge}
          onChange={(e) => setDraft({ ...draft, knowledge: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px]"
        />

        <label className="mt-3 block text-[11px] text-faint">
          Why (do not paraphrase)
        </label>
        <textarea
          value={draft.reasoning}
          onChange={(e) => setDraft({ ...draft, reasoning: e.target.value })}
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-muted"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-[11px] text-faint">
            Topic
            <select
              value={draft.topic}
              onChange={(e) =>
                setDraft({ ...draft, topic: e.target.value as Topic })
              }
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-faint">
            Confidence
            <select
              value={draft.confidence}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  confidence: e.target.value as ExtractionDraft["confidence"],
                })
              }
              className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block text-[11px] text-faint">
          People mentioned (comma separated)
        </label>
        <input
          value={draft.peopleMentioned.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              peopleMentioned: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px]"
        />

        <div className="mt-2">
          <ConfidenceDots value={draft.confidence} />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
            This would dispute {warnings.map((w) => w.subject).join(", ")} with{" "}
            {warnings
              .flatMap((w) => w.records.map((r) => r.id))
              .filter((id) => id !== "__draft__")
              .join(", ")}
            . It will be filed as a second side — not an overwrite.
          </div>
        ) : null}

        <button
          type="button"
          onClick={save}
          disabled={!draft.knowledge.trim() || !draft.reasoning.trim()}
          className="mt-4 w-full rounded-md bg-accent py-1.5 text-[13px] text-white disabled:opacity-40"
        >
          Save record
        </button>
        {savedId ? (
          <p className="mt-2 text-center text-[11px] text-ok">Filed as {savedId}.</p>
        ) : null}
      </aside>
    </div>
  );
}
