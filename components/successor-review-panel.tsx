"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, saveWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import {
  applyReviewMetric,
  reviewCompletion,
  SUCCESSOR_REVIEW_CHECKS,
  type SuccessorReview,
  type SuccessorReviewCheckKey,
} from "@/lib/successor-review";
import { IconCheck, IconChevronRight } from "./icons";

function blankReview(workspace: PersonalWorkspace): SuccessorReview {
  const now = new Date().toISOString();
  return {
    status: "pending",
    reviewerName: workspace.transition.successor || "Successor",
    startedAt: now,
    updatedAt: now,
    checks: {
      roleScope: false,
      activeWork: false,
      ownership: false,
      risks: false,
      openQuestions: false,
    },
    notes: "",
    submittedQuestions: [],
  };
}

export function SuccessorReviewPanel() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => setWorkspace(getCurrentWorkspace());
    refresh();
    window.addEventListener("understudy:cloud-hydrated", refresh);
    return () => window.removeEventListener("understudy:cloud-hydrated", refresh);
  }, []);

  const review = workspace?.successorReview;
  const criticalGaps = useMemo(
    () =>
      workspace?.transition.gaps.filter(
        (gap) =>
          gap.priority === "Critical" &&
          workspace.interviewGapStates[gap.question]?.status !== "not-relevant",
      ) ?? [],
    [workspace],
  );

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">No transition selected</h1>
        <p className="mt-2 text-sm text-muted">Create or open a handoff before starting successor review.</p>
      </div>
    );
  }

  const currentWorkspace = workspace;
  const transition = currentWorkspace.transition;
  const activeReview = review ?? blankReview(currentWorkspace);
  const completion = reviewCompletion(activeReview);
  const allChecks = completion === 100;

  function persistReview(nextReview: SuccessorReview, extraGap?: string) {
    const gap = extraGap?.trim();
    const transitionWithGap = gap
      ? {
          ...currentWorkspace.transition,
          gaps: [
            ...currentWorkspace.transition.gaps,
            { question: gap, topic: "Successor review", priority: "Important" as const },
          ].filter(
            (item, index, array) =>
              array.findIndex((candidate) => candidate.question.toLowerCase() === item.question.toLowerCase()) === index,
          ),
        }
      : currentWorkspace.transition;
    const transitionWithMetric = applyReviewMetric(transitionWithGap, nextReview);
    const next: PersonalWorkspace = {
      ...currentWorkspace,
      updatedAt: new Date().toISOString(),
      transition: transitionWithMetric,
      successorReview: nextReview,
    };
    setWorkspace(next);
    saveWorkspace(next);
  }

  function ensureReview() {
    if (review) return review;
    const next = blankReview(currentWorkspace);
    persistReview(next);
    setMessage("Successor review started. This is now a real verification state, not an inferred score.");
    return next;
  }

  function toggleCheck(key: SuccessorReviewCheckKey) {
    const current = ensureReview();
    const next: SuccessorReview = {
      ...current,
      status: current.status === "accepted" ? "pending" : current.status,
      acceptedAt: current.status === "accepted" ? undefined : current.acceptedAt,
      updatedAt: new Date().toISOString(),
      checks: { ...current.checks, [key]: !current.checks[key] },
    };
    persistReview(next);
    setMessage("");
  }

  function updateNotes(notes: string) {
    const current = ensureReview();
    persistReview({ ...current, notes, updatedAt: new Date().toISOString() });
  }

  function submitQuestion() {
    const text = question.trim();
    if (!text) return;
    const current = ensureReview();
    const next: SuccessorReview = {
      ...current,
      status: "changes-requested",
      acceptedAt: undefined,
      updatedAt: new Date().toISOString(),
      submittedQuestions: [...new Set([...current.submittedQuestions, text])],
    };
    persistReview(next, text);
    setQuestion("");
    setMessage("Question added to the handoff gaps. The transfer remains open until the team decides how to resolve it.");
  }

  function requestChanges() {
    const current = ensureReview();
    persistReview({
      ...current,
      status: "changes-requested",
      acceptedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
    setMessage("Changes requested. Successor review remains open.");
  }

  function acceptHandoff() {
    const current = ensureReview();
    if (!allChecks) {
      setMessage("Complete all five successor checks before accepting the handoff.");
      return;
    }
    if (criticalGaps.length) {
      setMessage(`Resolve ${criticalGaps.length} critical handoff gap${criticalGaps.length === 1 ? "" : "s"} before acceptance.`);
      return;
    }
    const now = new Date().toISOString();
    persistReview({ ...current, status: "accepted", acceptedAt: now, updatedAt: now });
    setMessage("Handoff accepted. Successor review is now a completed product event and contributes 100% of its readiness component.");
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Successor verification</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Can {transition.successor} continue the work?</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review the handoff from the next owner&apos;s perspective. Nothing here is inferred by AI. Each check is an explicit verification event.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-xs text-subtle">Review completion</p>
          <p className="mt-1 text-2xl font-semibold">{review ? completion : 0}%</p>
          <p className="mt-1 text-xs text-muted">{review?.status === "accepted" ? "Accepted" : review?.status === "changes-requested" ? "Changes requested" : review ? "In review" : "Not started"}</p>
        </div>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted">{message}</div>}

      {!review ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-medium">Start a real successor review</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">This creates a review record for {transition.successor}. Until then, the Successor review readiness component stays at 0.</p>
          <button onClick={() => void ensureReview()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Start review <IconChevronRight /></button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {SUCCESSOR_REVIEW_CHECKS.map((item, index) => {
                const checked = review.checks[item.key];
                return (
                  <button key={item.key} onClick={() => toggleCheck(item.key)} className={`flex w-full items-start gap-4 p-5 text-left hover:bg-card-hover ${index ? "border-t border-border" : ""}`}>
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${checked ? "border-ok bg-ok text-white" : "border-border-strong bg-background text-transparent"}`}><IconCheck className="h-3.5 w-3.5" /></span>
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-subtle">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-medium">Successor notes</h2>
              <textarea value={review.notes} onChange={(event) => updateNotes(event.target.value)} rows={5} placeholder="What still feels unclear, fragile, or easy to misunderstand?" className="mt-3 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none placeholder:text-faint" />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-medium">Ask a handoff question</h2>
              <p className="mt-1 text-sm leading-6 text-subtle">A submitted question becomes a real open gap in the handoff instead of disappearing into review notes.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you still need to know?" className="h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint" />
                <button onClick={submitQuestion} disabled={!question.trim()} className="rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-muted hover:bg-card-hover disabled:opacity-40">Add question</button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-medium">Review gate</p>
              <div className="mt-4 space-y-3 text-sm text-muted">
                <div className="flex justify-between gap-3"><span>Checklist</span><span>{completion}%</span></div>
                <div className="flex justify-between gap-3"><span>Critical gaps</span><span>{criticalGaps.length}</span></div>
                <div className="flex justify-between gap-3"><span>Questions raised</span><span>{review.submittedQuestions.length}</span></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-subtle">Acceptance requires every successor check and zero unresolved critical gaps. Lower-priority questions can remain visible after transition.</p>
            </div>

            {review.submittedQuestions.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-medium">Questions raised</p>
                <div className="mt-3 space-y-2">{review.submittedQuestions.map((item) => <p key={item} className="text-sm leading-5 text-muted">• {item}</p>)}</div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button onClick={requestChanges} className="rounded-lg border border-border-strong bg-card px-4 py-2.5 text-sm font-medium text-muted hover:bg-card-hover">Request changes</button>
              <button onClick={acceptHandoff} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Accept handoff</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
