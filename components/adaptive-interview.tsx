"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import type { PersonalWorkspace, InterviewGapDisposition } from "@/lib/personal-workspace";
import type { Transition } from "@/data/v2-demo";
import {
  blockingCriticalGaps,
  estimatedInterviewMinutes,
  focusInterviewGaps,
  parkedInterviewGaps,
  rankedInterviewGaps,
} from "@/lib/interview-priority";
import { IconCheck, IconChevronRight, IconSpark } from "./icons";

type Props = {
  workspace: PersonalWorkspace;
  onWorkspaceChange: (workspace: PersonalWorkspace) => void;
  onMessage: (message: string) => void;
};

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 12) {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((item) => {
      const value = key(item).toLowerCase().trim();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function metricValue(metrics: Transition["metrics"], label: string) {
  return metrics.find((metric) => metric.label === label)?.value ?? 0;
}

function calculateReadiness(metrics: Transition["metrics"]) {
  return Math.round(
    metricValue(metrics, "Responsibilities") * 0.2 +
      metricValue(metrics, "Active work") * 0.2 +
      metricValue(metrics, "Decisions") * 0.2 +
      metricValue(metrics, "Tacit knowledge") * 0.15 +
      metricValue(metrics, "Ownership") * 0.15 +
      metricValue(metrics, "Successor review") * 0.1,
  );
}

function mergeInterviewResult(
  workspace: PersonalWorkspace,
  result: ReconstructionResult,
  answer: string,
) {
  const previous = workspace.transition;
  const resolved = new Set(result.resolvedQuestions);
  const projects = mergeUnique(previous.projects, result.projects, (item) => item.name);
  const risks = mergeUnique(previous.risks, result.risks, (item) => item.title, 10);
  const gaps = previous.gaps.filter((gap) => !resolved.has(gap.question));

  const metrics = previous.metrics.map((old) => {
    if (old.label === "Successor review") return old;
    const incoming = result.metrics.find((metric) => metric.label === old.label);
    if (!incoming) return old;
    return {
      ...old,
      value: Math.max(old.value, incoming.value),
      note: incoming.note,
    };
  });
  const readiness = calculateReadiness(metrics);

  const interviewGapStates = { ...workspace.interviewGapStates };
  result.resolvedQuestions.forEach((question) => delete interviewGapStates[question]);

  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    interviewGapStates,
    transition: {
      ...previous,
      summary: result.summary || previous.summary,
      sources: [...previous.sources, result.source],
      projects,
      risks,
      gaps,
      metrics,
      readiness,
      status: readiness >= 80 ? "Ready for review" : readiness >= 55 ? "In progress" : "Needs attention",
    },
    sourceBodies: {
      ...workspace.sourceBodies,
      [result.source.id]: answer,
    },
  } satisfies PersonalWorkspace;
}

const DISPOSITION_COPY: Record<InterviewGapDisposition, string> = {
  deferred: "Skipped for now. It will move behind the other questions.",
  unknown: "Marked as unknown. It stays visible as a follow-up instead of forcing an answer.",
  "ask-someone": "Marked for another person. Critical items still block the final handoff until resolved.",
  "not-relevant": "Removed from this handoff as not relevant.",
};

const STATUS_LABELS: Record<InterviewGapDisposition, string> = {
  deferred: "Skipped for now",
  unknown: "I don't know",
  "ask-someone": "Ask someone else",
  "not-relevant": "Not relevant",
};

export function AdaptiveInterview({ workspace, onWorkspaceChange, onMessage }: Props) {
  const transition = workspace.transition;
  const states = workspace.interviewGapStates ?? {};
  const ranked = useMemo(
    () => rankedInterviewGaps(transition.gaps, transition.risks, states),
    [transition.gaps, transition.risks, states],
  );
  const focus = useMemo(
    () => focusInterviewGaps(transition.gaps, transition.risks, states, 3),
    [transition.gaps, transition.risks, states],
  );
  const parked = useMemo(
    () => parkedInterviewGaps(transition.gaps, states),
    [transition.gaps, states],
  );
  const blocking = useMemo(
    () => blockingCriticalGaps(transition.gaps, states),
    [transition.gaps, states],
  );
  const handled = useMemo(
    () => transition.gaps.filter((gap) => Boolean(states[gap.question])),
    [transition.gaps, states],
  );

  const [selectedQuestion, setSelectedQuestion] = useState(focus[0]?.question ?? "");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!focus.length) {
      setSelectedQuestion("");
      return;
    }
    if (!focus.some((gap) => gap.question === selectedQuestion)) {
      setSelectedQuestion(focus[0].question);
      setAnswer("");
    }
  }, [focus, selectedQuestion]);

  const current = focus.find((gap) => gap.question === selectedQuestion) ?? focus[0];
  const focusMinutes = estimatedInterviewMinutes(focus.length);

  function markDisposition(status: InterviewGapDisposition) {
    if (!current) return;
    const nextQuestion = focus.find((gap) => gap.question !== current.question)?.question ?? "";
    const next = {
      ...workspace,
      updatedAt: new Date().toISOString(),
      interviewGapStates: {
        ...states,
        [current.question]: { status, updatedAt: new Date().toISOString() },
      },
    } satisfies PersonalWorkspace;
    onWorkspaceChange(next);
    setAnswer("");
    setSelectedQuestion(nextQuestion);
    onMessage(DISPOSITION_COPY[status]);
  }

  function restoreQuestion(question: string) {
    const nextStates = { ...states };
    delete nextStates[question];
    onWorkspaceChange({
      ...workspace,
      updatedAt: new Date().toISOString(),
      interviewGapStates: nextStates,
    });
    setSelectedQuestion(question);
    onMessage("Question returned to the active interview queue.");
  }

  async function submitAnswer() {
    if (!current || answer.trim().length < 20 || busy) return;
    setBusy(true);
    onMessage("");
    try {
      const response = await fetch("/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transition: {
            person: transition.person,
            role: transition.role,
            department: transition.department,
            successor: transition.successor,
            targetDate: transition.targetDate,
          },
          source: {
            title: `Handoff interview · ${current.topic}`,
            text: answer,
            provider: "Understudy interview",
            kind: "interview",
          },
          openGaps: transition.gaps,
          primaryQuestion: current.question,
        }),
      });
      const payload = (await response.json()) as {
        result?: ReconstructionResult;
        usedModel?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Could not process this interview answer.");
      }

      const next = mergeInterviewResult(workspace, payload.result, answer.trim());
      onWorkspaceChange(next);
      setAnswer("");
      setSelectedQuestion("");

      const resolvedCount = payload.result.resolvedQuestions.length;
      onMessage(
        resolvedCount > 1
          ? `Answer saved. It resolved ${resolvedCount} related knowledge gaps, so Understudy will not ask those separately.`
          : "Answer saved. Understudy updated the handoff and removed the question it answered.",
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Interview answer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!transition.gaps.length) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-7 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-ok/30 bg-ok/10 text-ok"><IconCheck /></span>
          <h2 className="mt-4 text-lg font-medium">No interview questions needed</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-subtle">The current evidence does not leave an interview gap. Understudy will not invent questions just to create work.</p>
        </div>
      </section>
    );
  }

  if (!focus.length) {
    return (
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">Nothing else to answer right now</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            {blocking.length
              ? `${blocking.length} critical item${blocking.length === 1 ? " still needs" : "s still need"} follow-up, but none requires another essay from you right now.`
              : "You have handled the current interview queue. Lower-priority open context can remain visible in the handoff."}
          </p>
        </div>
        {parked.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium">Needs follow-up</p>
            <div className="mt-3 space-y-2">
              {parked.map((gap) => (
                <div key={gap.question} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div><p className="text-sm text-muted">{gap.question}</p><p className="mt-1 text-xs text-subtle">{STATUS_LABELS[states[gap.question].status]}</p></div>
                  <button onClick={() => restoreQuestion(gap.question)} className="shrink-0 text-xs text-muted hover:text-foreground">Bring back</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Adaptive interview</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">Understudy is showing only the highest-value questions from the evidence gaps. Answer one well and it may close several related gaps.</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted">
          Focus set: {focus.length} question{focus.length === 1 ? "" : "s"} · ~{focusMinutes} min
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          {focus.map((gap, index) => {
            const active = current?.question === gap.question;
            return (
              <button
                key={gap.question}
                onClick={() => { setSelectedQuestion(gap.question); setAnswer(""); }}
                className={`w-full rounded-xl border p-3 text-left ${active ? "border-border-strong bg-card-hover" : "border-border bg-card hover:bg-card-hover"}`}
              >
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-subtle">Question {index + 1}</span><span className={`rounded px-1.5 py-0.5 text-[10px] ${gap.priority === "Critical" ? "bg-warning/10 text-warning" : "bg-background text-subtle"}`}>{gap.priority}</span></div>
                <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">{gap.question}</p>
              </button>
            );
          })}
          {ranked.length > focus.length && <p className="px-1 pt-1 text-xs leading-5 text-faint">{ranked.length - focus.length} lower-value gap{ranked.length - focus.length === 1 ? " is" : "s are"} held back until this focus set is handled.</p>}
        </div>

        {current && (
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-subtle"><span>{current.topic}</span><span>·</span><span>{current.priority}</span></div>
            <h3 className="mt-3 text-xl font-medium leading-8 tracking-tight">{current.question}</h3>
            <p className="mt-2 text-xs leading-5 text-faint">Answer naturally. You do not need to format it like documentation. Understudy will extract the useful handoff context.</p>

            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={6}
              placeholder="Explain this the way you would to the person taking over…"
              className="mt-5 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none placeholder:text-faint"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => markDisposition("unknown")} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">I don&apos;t know</button>
                <button onClick={() => markDisposition("ask-someone")} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Ask someone else</button>
                <button onClick={() => markDisposition("not-relevant")} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Not relevant</button>
                <button onClick={() => markDisposition("deferred")} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Skip for now</button>
              </div>
              <button disabled={answer.trim().length < 20 || busy} onClick={() => void submitAnswer()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-35">
                {busy ? "Updating…" : "Save answer"} <IconSpark />
              </button>
            </div>
          </div>
        )}
      </div>

      {(parked.length > 0 || handled.some((gap) => states[gap.question]?.status === "not-relevant")) && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Handled without an answer</p><span className="text-xs text-subtle">These are not silently discarded</span></div>
          <div className="mt-3 space-y-2">
            {handled
              .filter((gap) => states[gap.question]?.status !== "deferred")
              .map((gap) => (
                <div key={gap.question} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div><p className="text-sm leading-5 text-muted">{gap.question}</p><p className="mt-1 text-xs text-subtle">{STATUS_LABELS[states[gap.question].status]}</p></div>
                  <button onClick={() => restoreQuestion(gap.question)} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted hover:text-foreground">Reopen <IconChevronRight className="h-3 w-3" /></button>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
