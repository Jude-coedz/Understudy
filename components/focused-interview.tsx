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
import { relatedSourcesForGap } from "@/lib/source-provenance";
import { IconCheck, IconFile, IconSpark } from "./icons";
import { SourcePreviewDialog } from "./source-preview-dialog";
import { VoiceInput } from "./voice-input";

type Props = {
  workspace: PersonalWorkspace;
  onWorkspaceChange: (workspace: PersonalWorkspace) => void;
  onMessage: (message: string) => void;
  onComplete?: () => void;
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
    interviewCompletedAt: undefined,
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

const LIMITED_ANALYSIS_GAPS: Transition["gaps"] = [
  {
    question: "What active work still needs a next step, owner, or deadline that the current evidence does not make explicit?",
    topic: "Active work",
    priority: "Critical",
  },
  {
    question: "Which decisions, exceptions, dependencies, or escalation paths would a successor need to know that are not documented here?",
    topic: "Continuity context",
    priority: "Critical",
  },
  {
    question: "What recurring responsibilities, rituals, or stakeholder expectations are part of this role but are not captured in the current evidence set?",
    topic: "Role scope",
    priority: "Important",
  },
];

const DISPOSITIONS: Array<{ value: InterviewGapDisposition; label: string; detail: string }> = [
  { value: "unknown", label: "I don’t know", detail: "Keep this visible as an unresolved follow-up." },
  { value: "ask-someone", label: "Someone else knows", detail: "Keep it visible so the team can get the answer from the right person." },
  { value: "not-relevant", label: "Not relevant", detail: "Remove this question from this handoff." },
  { value: "deferred", label: "Come back later", detail: "Move it behind the other active questions." },
];

export function FocusedInterview({ workspace, onWorkspaceChange, onMessage, onComplete }: Props) {
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
  const [voiceListening, setVoiceListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [previewSourceId, setPreviewSourceId] = useState("");

  useEffect(() => {
    if (
      workspace.roleEvidence?.usedModel !== false ||
      transition.gaps.length > 0 ||
      workspace.interviewCompletedAt
    ) {
      return;
    }

    onWorkspaceChange({
      ...workspace,
      updatedAt: new Date().toISOString(),
      interviewCompletedAt: undefined,
      transition: { ...transition, gaps: LIMITED_ANALYSIS_GAPS },
    });
    onMessage("Limited analysis could not generate model-backed gap questions, so Understudy added three continuity checks for active work, ownership, and undocumented context.");
  }, [workspace.roleEvidence?.usedModel, transition.gaps.length, workspace.interviewCompletedAt]);

  useEffect(() => {
    if (!focus.length) {
      setSelectedQuestion("");
      return;
    }
    if (!focus.some((gap) => gap.question === selectedQuestion)) {
      setSelectedQuestion(focus[0].question);
      setAnswer("");
      setUsedVoice(false);
      setShowExceptions(false);
      setShowEvidence(false);
    }
  }, [focus, selectedQuestion]);

  const current = focus.find((gap) => gap.question === selectedQuestion) ?? focus[0];
  const currentIndex = current ? focus.findIndex((gap) => gap.question === current.question) : -1;
  const minutes = estimatedInterviewMinutes(focus.length);
  const references = useMemo(
    () => current ? relatedSourcesForGap(workspace, current, 3) : [],
    [workspace, current],
  );
  const previewSource = transition.sources.find((source) => source.id === previewSourceId) ?? null;
  const modelBackedReview = workspace.roleEvidence?.usedModel !== false;

  function chooseDisposition(status: InterviewGapDisposition) {
    if (!current) return;
    const nextQuestion = focus.find((gap) => gap.question !== current.question)?.question ?? "";
    onWorkspaceChange({
      ...workspace,
      updatedAt: new Date().toISOString(),
      interviewCompletedAt: undefined,
      interviewGapStates: { ...states, [current.question]: { status, updatedAt: new Date().toISOString() } },
    });
    setSelectedQuestion(nextQuestion);
    setAnswer("");
    setUsedVoice(false);
    setShowExceptions(false);
    setShowEvidence(false);
    onMessage(status === "not-relevant" ? "Question removed as not relevant." : status === "ask-someone" ? "Marked as a follow-up for someone else." : status === "unknown" ? "Kept as an unresolved follow-up. It will not disappear from the handoff." : "Moved behind the other active questions.");
  }

  function restoreQuestion(question: string) {
    const nextStates = { ...states };
    delete nextStates[question];
    onWorkspaceChange({ ...workspace, updatedAt: new Date().toISOString(), interviewCompletedAt: undefined, interviewGapStates: nextStates });
    setSelectedQuestion(question);
    setAnswer("");
    setUsedVoice(false);
  }

  function finishGapReview() {
    if (blocking.length || focus.length) return;
    const now = new Date().toISOString();
    onWorkspaceChange({ ...workspace, updatedAt: now, interviewCompletedAt: now });
    onMessage(parked.length ? `Context review finished with ${parked.length} open follow-up${parked.length === 1 ? "" : "s"} kept visible in the handoff.` : "Context complete. Building the handoff draft.");
    onComplete?.();
  }

  async function submitAnswer() {
    if (!current || !answer.trim() || busy || voiceListening) return;
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
            provider: usedVoice ? "Understudy interview · voice" : "Understudy interview",
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
      setUsedVoice(false);
      setSelectedQuestion("");
      setShowExceptions(false);
      setShowEvidence(false);
      onMessage(payload.result.resolvedQuestions.length > 1 ? `Answer saved. It resolved ${payload.result.resolvedQuestions.length} related gaps.` : "Answer saved. Understudy is checking what remains.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Interview answer failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!focus.length) {
    const hasCriticalFollowUp = blocking.length > 0;
    return (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className={`rounded-[24px] border p-6 sm:p-7 ${hasCriticalFollowUp ? "border-warning/25 bg-warning/5" : "border-ok/20 bg-ok/5"}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${hasCriticalFollowUp ? "bg-warning/10 text-warning" : "bg-ok/10 text-ok"}`}>
                <IconCheck />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-subtle">
                {hasCriticalFollowUp ? "One blocking question remains" : parked.length ? "Questions handled" : "Context complete"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                {hasCriticalFollowUp
                  ? "A blocking question is still open."
                  : parked.length
                    ? "You have answered everything you can for now."
                    : "Understudy has enough context to build the handoff."}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {hasCriticalFollowUp
                  ? "This affects continuity, so marking it as unknown does not make it disappear. Bring it back when the right person can answer it."
                  : parked.length
                    ? `The remaining ${parked.length} follow-up${parked.length === 1 ? "" : "s"} will stay visible for the successor. They are not being treated as resolved.`
                    : "There are no more active context questions. Finish this step and Understudy will assemble the handoff for successor review."}
              </p>
            </div>
            {!hasCriticalFollowUp && (
              <div className="min-w-[180px] rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Next</p>
                <p className="mt-2 text-sm font-semibold">Handoff draft</p>
                <p className="mt-1 text-xs leading-5 text-subtle">Role summary, active work, risks, your answers, and source evidence.</p>
              </div>
            )}
          </div>
        </div>

        {parked.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-semibold">Follow-ups that stay open</p>
              <p className="mt-1 text-xs text-subtle">These remain visible so the successor knows what still needs an answer.</p>
            </div>
            <div className="divide-y divide-border">
              {parked.map((gap) => (
                <div key={gap.question} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm leading-6 text-muted">{gap.question}</p>
                    <p className="mt-1 text-xs text-subtle">{states[gap.question]?.status === "ask-someone" ? "Someone else needs to answer" : "Answer not known yet"} · {gap.priority}</p>
                  </div>
                  <button onClick={() => restoreQuestion(gap.question)} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-background">Answer now</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasCriticalFollowUp && !workspace.interviewCompletedAt && (
          <button onClick={finishGapReview} className="primary-action-depth inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white">
            {parked.length ? `Finish with ${parked.length} open follow-up${parked.length === 1 ? "" : "s"}` : "Build the handoff"}
          </button>
        )}

        {workspace.interviewCompletedAt && (
          <div className="flex items-center gap-3 rounded-xl border border-ok/20 bg-ok/5 px-4 py-3 text-sm text-muted">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-4 w-4" /></span>
            <span><strong className="font-semibold text-foreground">Context review complete.</strong> Open the handoff draft when you are ready.</span>
          </div>
        )}
      </motion.div>
    );
  }

  const criticalRemaining = focus.filter((gap) => gap.priority === "Critical").length;
  const whyCopy = references.length
    ? "Understudy found related evidence, but none of it answers this clearly enough for the next owner."
    : "This context does not appear in the evidence you provided, so Understudy needs it directly from a person.";

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-accent/15 bg-accent-soft/45 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{transition.person}, Understudy found {focus.length} thing{focus.length === 1 ? "" : "s"} only you can explain.</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">The evidence already covers the rest. Give {transition.successor} the missing context they would otherwise have to rediscover after you leave.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted">{focus.length} left</span>
            {criticalRemaining > 0 && <span className="rounded-full border border-danger/15 bg-danger/8 px-2.5 py-1 text-[11px] font-semibold text-danger">{criticalRemaining} blocking</span>}
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-subtle">~{minutes} min</span>
          </div>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Context questions">
        {focus.map((gap, index) => (
          <button
            key={gap.question}
            onClick={() => {
              setSelectedQuestion(gap.question);
              setAnswer("");
              setUsedVoice(false);
              setShowExceptions(false);
              setShowEvidence(false);
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${gap.question === current?.question ? "border-accent/25 bg-accent-soft text-accent" : "border-border bg-card text-subtle hover:text-foreground"}`}
          >
            {index + 1}. {gap.topic}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {current && (
          <motion.div
            key={current.question}
            initial={reducedMotion ? false : { opacity: 0, x: 14, scale: 0.995 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -10, scale: 0.997 }}
            transition={reducedMotion ? { duration: 0 } : { x: { type: "spring", stiffness: 390, damping: 34 }, opacity: { duration: 0.16 } }}
            className="space-y-4"
          >
            <div className="rounded-[24px] border border-border-strong bg-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${current.priority === "Critical" ? "bg-danger/8 text-danger" : "bg-warning/8 text-warning"}`}>
                  {current.priority === "Critical" ? "Blocks handoff" : "Useful context"}
                </span>
                <span className="text-xs text-subtle">{current.topic}</span>
              </div>

              <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-9 tracking-[-0.035em]">{current.question}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{whyCopy}</p>

              {references.length > 0 && (
                <div className="mt-4">
                  <button type="button" onClick={() => setShowEvidence((value) => !value)} className="inline-flex items-center gap-2 text-xs font-semibold text-accent">
                    <IconFile className="h-3.5 w-3.5" />
                    {showEvidence ? "Hide related evidence" : `See the ${references.length} related source${references.length === 1 ? "" : "s"}`}
                  </button>
                  <AnimatePresence initial={false}>
                    {showEvidence && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3">
                          {references.map((reference) => (
                            <div key={reference.source.id} className="flex items-start gap-3 rounded-lg bg-card p-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-background"><IconFile className="h-4 w-4 text-muted" /></span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{reference.source.title}</p>
                                <p className="mt-0.5 text-xs text-subtle">{reference.reason}</p>
                              </div>
                              <button onClick={() => setPreviewSourceId(reference.source.id)} className="shrink-0 text-xs font-medium text-accent">Open</button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="mt-6 overflow-hidden rounded-xl border border-border bg-background transition-colors focus-within:border-border-strong">
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={10}
                  autoFocus
                  placeholder={"Explain what " + transition.successor + " needs to know…"}
                  className="min-h-[260px] w-full resize-y bg-transparent p-5 text-sm leading-7 outline-none placeholder:text-faint"
                />
                <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <VoiceInput value={answer} onChange={setAnswer} onListeningChange={setVoiceListening} onVoiceUsed={() => setUsedVoice(true)} disabled={busy} />
                  <span className="text-xs text-faint">{usedVoice ? "Voice captured. Edit anything before saving." : "Type it or dictate it."}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setShowExceptions((value) => !value)} className="text-left text-sm text-subtle hover:text-muted">I can’t answer this</button>
                <motion.button
                  whileHover={reducedMotion || busy || voiceListening ? undefined : { y: -1.5, scale: 1.01 }}
                  whileTap={reducedMotion ? undefined : { y: 0, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.65 }}
                  disabled={!answer.trim() || busy || voiceListening}
                  onClick={() => void submitAnswer()}
                  className="primary-action-depth inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-35"
                >
                  <span className="relative z-10">{busy ? "Updating handoff…" : voiceListening ? "Stop dictation to save" : focus.length > 1 ? "Save and next question" : "Save final answer"}</span>
                  <IconSpark className="relative z-10 h-4 w-4" />
                </motion.button>
              </div>

              <AnimatePresence initial={false}>
                {showExceptions && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold text-subtle">That’s okay. What should Understudy do with this question?</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {DISPOSITIONS.map((item) => (
                          <button key={item.value} onClick={() => chooseDisposition(item.value)} className="rounded-xl border border-border bg-background p-3 text-left hover:border-border-strong hover:bg-card-hover">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="mt-1 text-xs leading-5 text-subtle">{item.detail}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Why Understudy asked</p>
                <p className="mt-2 text-xs leading-5 text-muted">The source material does not explain this clearly enough for {transition.successor} to act on.</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Your answer becomes</p>
                <p className="mt-2 text-xs leading-5 text-muted">Self-reported handoff context that stays searchable in Ask Understudy with its provenance.</p>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-accent-soft/45 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">After the last answer</p>
                <p className="mt-2 text-xs leading-5 text-muted">Understudy builds the handoff draft for {transition.successor} to review.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ranked.length > focus.length && <p className="mt-4 text-center text-xs leading-5 text-faint">Understudy is holding back {ranked.length - focus.length} lower-priority question{ranked.length - focus.length === 1 ? "" : "s"} so this stays focused.</p>}

      <SourcePreviewDialog source={previewSource} body={previewSource ? workspace.sourceBodies[previewSource.id] ?? "" : ""} onClose={() => setPreviewSourceId("")} title="Related evidence" />
    </div>
  );
}
