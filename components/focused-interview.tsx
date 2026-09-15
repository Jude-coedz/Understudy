"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import type { InterviewGapDisposition, PersonalWorkspace } from "@/lib/personal-workspace";
import type { Transition } from "@/data/v2-demo";
import {
  blockingCriticalGaps,
  estimatedInterviewMinutes,
  focusInterviewGaps,
  parkedInterviewGaps,
  rankedInterviewGaps,
} from "@/lib/interview-priority";
import { IconCheck, IconSpark } from "./icons";

type Props = {
  workspace: PersonalWorkspace;
  onWorkspaceChange: (workspace: PersonalWorkspace) => void;
  onMessage: (message: string) => void;
};

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 12) {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((item) => {
      const value = key(item).trim().toLowerCase();
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

function mergeInterviewResult(workspace: PersonalWorkspace, result: ReconstructionResult, answer: string) {
  const previous = workspace.transition;
  const resolved = new Set(result.resolvedQuestions);
  const metrics = previous.metrics.map((old) => {
    if (old.label === "Successor review") return old;
    const incoming = result.metrics.find((metric) => metric.label === old.label);
    return incoming ? { ...old, value: Math.max(old.value, incoming.value), note: incoming.note } : old;
  });
  const interviewGapStates = { ...workspace.interviewGapStates };
  result.resolvedQuestions.forEach((question) => delete interviewGapStates[question]);
  const readiness = calculateReadiness(metrics);

  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    interviewGapStates,
    transition: {
      ...previous,
      summary: result.summary || previous.summary,
      sources: [...previous.sources, result.source],
      projects: mergeUnique(previous.projects, result.projects, (item) => item.name),
      risks: mergeUnique(previous.risks, result.risks, (item) => item.title, 10),
      gaps: previous.gaps.filter((gap) => !resolved.has(gap.question)),
      metrics,
      readiness,
      status: readiness >= 80 ? "Ready for review" : readiness >= 55 ? "In progress" : "Needs attention",
    },
    sourceBodies: { ...workspace.sourceBodies, [result.source.id]: answer },
  } satisfies PersonalWorkspace;
}

const DISPOSITIONS: Array<{ value: InterviewGapDisposition; label: string; detail: string }> = [
  { value: "unknown", label: "I don’t know", detail: "Keep this visible as an unresolved follow-up." },
  { value: "ask-someone", label: "Someone else knows", detail: "Assign this context to another person to resolve." },
  { value: "not-relevant", label: "Not relevant", detail: "Remove this question from this handoff." },
  { value: "deferred", label: "Come back later", detail: "Move it behind the other active questions." },
];

export function FocusedInterview({ workspace, onWorkspaceChange, onMessage }: Props) {
  const reducedMotion = useReducedMotion();
  const transition = workspace.transition;
  const states = workspace.interviewGapStates ?? {};
  const focus = useMemo(() => focusInterviewGaps(transition.gaps, transition.risks, states, 3), [transition.gaps, transition.risks, states]);
  const ranked = useMemo(() => rankedInterviewGaps(transition.gaps, transition.risks, states), [transition.gaps, transition.risks, states]);
  const parked = useMemo(() => parkedInterviewGaps(transition.gaps, states), [transition.gaps, states]);
  const blocking = useMemo(() => blockingCriticalGaps(transition.gaps, states), [transition.gaps, states]);
  const [selectedQuestion, setSelectedQuestion] = useState(focus[0]?.question ?? "");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);

  useEffect(() => {
    if (!focus.length) {
      setSelectedQuestion("");
      return;
    }
    if (!focus.some((gap) => gap.question === selectedQuestion)) {
      setSelectedQuestion(focus[0].question);
      setAnswer("");
      setShowExceptions(false);
    }
  }, [focus, selectedQuestion]);

  const current = focus.find((gap) => gap.question === selectedQuestion) ?? focus[0];
  const currentIndex = current ? focus.findIndex((gap) => gap.question === current.question) : -1;
  const minutes = estimatedInterviewMinutes(focus.length);

  function chooseDisposition(status: InterviewGapDisposition) {
    if (!current) return;
    const nextQuestion = focus.find((gap) => gap.question !== current.question)?.question ?? "";
    onWorkspaceChange({
      ...workspace,
      updatedAt: new Date().toISOString(),
      interviewGapStates: { ...states, [current.question]: { status, updatedAt: new Date().toISOString() } },
    });
    setSelectedQuestion(nextQuestion);
    setAnswer("");
    setShowExceptions(false);
    onMessage(status === "not-relevant" ? "Question removed as not relevant." : status === "ask-someone" ? "Marked for another person to resolve." : status === "unknown" ? "Marked as unknown and kept visible for follow-up." : "Question moved behind the other active gaps.");
  }

  function restoreQuestion(question: string) {
    const nextStates = { ...states };
    delete nextStates[question];
    onWorkspaceChange({ ...workspace, updatedAt: new Date().toISOString(), interviewGapStates: nextStates });
    setSelectedQuestion(question);
    setAnswer("");
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
            text: answer.trim(),
            provider: "Understudy interview",
            kind: "interview",
          },
          openGaps: transition.gaps,
          primaryQuestion: current.question,
        }),
      });
      const payload = (await response.json()) as { result?: ReconstructionResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not process this answer.");
      const next = mergeInterviewResult(workspace, payload.result, answer.trim());
      onWorkspaceChange(next);
      setAnswer("");
      setSelectedQuestion("");
      setShowExceptions(false);
      onMessage(payload.result.resolvedQuestions.length > 1 ? `Answer saved. It resolved ${payload.result.resolvedQuestions.length} related gaps.` : "Answer saved and the handoff was updated.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Interview answer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!transition.gaps.length || (!focus.length && !blocking.length)) {
    return (
      <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-ok/25 bg-ok/5 p-7 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck /></span>
        <h2 className="mt-4 text-lg font-medium">Nothing else needs an answer right now.</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Understudy will not create questions just to make the interview feel complete.</p>
      </motion.div>
    );
  }

  if (!focus.length) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">The remaining items need follow-up, not another essay.</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{blocking.length ? `${blocking.length} critical item${blocking.length === 1 ? " is" : "s are"} still unresolved.` : "The current interview queue is handled."}</p>
        </div>
        {parked.length > 0 && <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{parked.map((gap) => <div key={gap.question} className="flex items-start justify-between gap-4 p-4"><div><p className="text-sm leading-6 text-muted">{gap.question}</p><p className="mt-1 text-xs text-subtle">Follow-up required</p></div><button onClick={() => restoreQuestion(gap.question)} className="shrink-0 text-xs font-medium text-accent">Bring back</button></div>)}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-subtle">Question {currentIndex + 1} of up to {focus.length}</p>
          <p className="mt-1 text-xs text-faint">About {minutes} minute{minutes === 1 ? "" : "s"} for this focus set</p>
        </div>
        <div className="flex gap-1.5" aria-label="Interview progress">{focus.map((gap, index) => <span key={gap.question} className={`h-1.5 rounded-full transition-all ${index === currentIndex ? "w-8 bg-accent" : "w-3 bg-surface-3"}`} />)}</div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {current && (
          <motion.div
            key={current.question}
            initial={reducedMotion ? false : { opacity: 0, x: 18, scale: 0.992 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -14, scale: 0.995 }}
            transition={reducedMotion ? { duration: 0 } : { x: { type: "spring", stiffness: 390, damping: 34 }, opacity: { duration: 0.2 } }}
            className="rounded-2xl border border-border-strong bg-card p-6 shadow-sm sm:p-7"
          >
            <div className="flex items-center gap-2 text-xs text-subtle"><span>{current.topic}</span><span>·</span><span className={current.priority === "Critical" ? "text-warning" : ""}>{current.priority}</span></div>
            <h2 className="mt-4 max-w-2xl text-2xl font-medium leading-9 tracking-[-0.03em]">{current.question}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-subtle">Answer it the way you would explain it to the person taking over. No formatting required.</p>

            <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={7} autoFocus placeholder="Explain what they need to know…" className="mt-6 w-full resize-none rounded-xl border border-border bg-background p-4 text-sm leading-6 outline-none placeholder:text-faint focus:border-border-strong" />

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setShowExceptions((value) => !value)} className="text-left text-sm text-subtle hover:text-muted">I can’t answer this</button>
              <motion.button whileTap={reducedMotion ? undefined : { scale: 0.97 }} disabled={answer.trim().length < 20 || busy} onClick={() => void submitAnswer()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-white disabled:opacity-35">{busy ? "Updating the handoff…" : "Save and continue"}<IconSpark /></motion.button>
            </div>

            <AnimatePresence initial={false}>
              {showExceptions && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-xs font-medium text-subtle">That’s okay. What should happen instead?</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">{DISPOSITIONS.map((item) => <button key={item.value} onClick={() => chooseDisposition(item.value)} className="rounded-xl border border-border bg-background p-3 text-left hover:border-border-strong hover:bg-card-hover"><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-xs leading-5 text-subtle">{item.detail}</p></button>)}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {ranked.length > focus.length && <p className="mt-4 text-center text-xs leading-5 text-faint">Understudy is holding back {ranked.length - focus.length} lower-value question{ranked.length - focus.length === 1 ? "" : "s"} until this focus set is handled.</p>}
    </div>
  );
}
