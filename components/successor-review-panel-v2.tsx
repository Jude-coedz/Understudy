"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, saveWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { applyReviewMetric, SUCCESSOR_REVIEW_CHECKS, type SuccessorReview } from "@/lib/successor-review";
import { IconCheck, IconChevronRight } from "./icons";

function reviewFor(workspace: PersonalWorkspace): SuccessorReview {
  const now = new Date().toISOString();
  return workspace.successorReview ?? {
    status: "pending",
    reviewerName: workspace.transition.successor || "Successor",
    startedAt: now,
    updatedAt: now,
    checks: { roleScope: false, activeWork: false, ownership: false, risks: false, openQuestions: false },
    notes: "",
    submittedQuestions: [],
  };
}

export function SuccessorReviewPanelV2() {
  const reducedMotion = useReducedMotion();
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => {
      const current = getCurrentWorkspace();
      setWorkspace(current);
      setNotes(current?.successorReview?.notes ?? "");
      setNotesDirty(false);
    };
    refresh();
    window.addEventListener("understudy:cloud-hydrated", refresh);
    window.addEventListener("understudy:workspace-saved", refresh);
    return () => {
      window.removeEventListener("understudy:cloud-hydrated", refresh);
      window.removeEventListener("understudy:workspace-saved", refresh);
    };
  }, []);

  const criticalGaps = useMemo(
    () => workspace?.transition.gaps.filter((gap) => gap.priority === "Critical" && workspace.interviewGapStates[gap.question]?.status !== "not-relevant") ?? [],
    [workspace],
  );

  if (!workspace) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center"><h1 className="text-2xl font-semibold">No handoff selected.</h1><p className="mt-2 text-sm text-muted">Choose a handoff before successor verification.</p><Link href="/handoffs" className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white">My handoffs</Link></div>;
  }

  if (!workspace.interviewCompletedAt) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center"><p className="text-xs font-medium uppercase tracking-[0.12em] text-warning">Gap review not finished</p><h1 className="mt-2 text-2xl font-semibold">Finish Step 3 first.</h1><p className="mt-2 text-sm leading-6 text-muted">Successor verification is the final step, not a shortcut around unresolved handoff context.</p><Link href="/workspace" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Back to gap review <IconChevronRight /></Link></div>;
  }

  const current = workspace;
  const transition = current.transition;
  const review = reviewFor(current);

  function persist(nextReview: SuccessorReview, extraGap?: string) {
    const text = extraGap?.trim();
    const transitionWithGap = text
      ? {
          ...current.transition,
          gaps: [...current.transition.gaps, { question: text, topic: "Successor review", priority: "Important" as const }]
            .filter((item, index, all) => all.findIndex((candidate) => candidate.question.toLowerCase() === item.question.toLowerCase()) === index),
        }
      : current.transition;
    const transitionWithMetric = applyReviewMetric(transitionWithGap, nextReview);
    const next: PersonalWorkspace = {
      ...current,
      updatedAt: new Date().toISOString(),
      transition: transitionWithMetric,
      successorReview: nextReview,
    };
    setWorkspace(next);
    saveWorkspace(next);
    return next;
  }

  function saveNotes() {
    const saved = notes.trimEnd();
    persist({ ...review, notes: saved, updatedAt: new Date().toISOString() });
    setNotes(saved);
    setNotesDirty(false);
    setMessage("Successor notes saved to this handoff record.");
  }

  function submitQuestion() {
    const text = question.trim();
    if (!text) return;
    const next: SuccessorReview = {
      ...review,
      status: "changes-requested",
      acceptedAt: undefined,
      updatedAt: new Date().toISOString(),
      notes: notes.trimEnd(),
      submittedQuestions: [...new Set([...review.submittedQuestions, text])],
    };
    persist(next, text);
    setQuestion("");
    setNotes(next.notes);
    setNotesDirty(false);
    setMessage("Follow-up saved. It is now part of the handoff's open questions and successor review record.");
  }

  function requestChanges() {
    persist({ ...review, status: "changes-requested", acceptedAt: undefined, notes: notes.trimEnd(), updatedAt: new Date().toISOString() });
    setNotesDirty(false);
    setMessage("Changes requested. The handoff remains open and the successor review is saved.");
  }

  function accept() {
    if (criticalGaps.length) {
      setMessage(`Resolve ${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? "" : "s"} before acceptance.`);
      return;
    }
    const now = new Date().toISOString();
    const checks = Object.fromEntries(SUCCESSOR_REVIEW_CHECKS.map((item) => [item.key, true])) as SuccessorReview["checks"];
    persist({
      ...review,
      status: "accepted",
      reviewerName: transition.successor || review.reviewerName,
      notes: notes.trimEnd(),
      checks,
      acceptedAt: now,
      updatedAt: now,
    });
    setNotesDirty(false);
    setMessage("");
  }

  if (workspace.successorReview?.status === "accepted") {
    const accepted = workspace.successorReview;
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 text-center lg:px-8 lg:py-20">
        <motion.span initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-7 w-7" /></motion.span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ok">Handoff complete</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{transition.successor} accepted the handoff.</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">The green verification state now means the successor explicitly accepted all five statements below. Nothing is treated as verified before this action.</p>
        <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-ok/20 bg-ok/5 p-4 text-left">
          {SUCCESSOR_REVIEW_CHECKS.map((item) => <div key={item.key} className="flex items-center gap-3 py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white"><IconCheck className="h-3.5 w-3.5" /></span><span className="text-sm text-muted">{item.label}</span></div>)}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/handoffs" className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-white">Back to my handoffs</Link><Link href="/record" className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-muted">View handoff record</Link></div>
        <p className="mt-5 text-xs text-subtle">Accepted {accepted.acceptedAt ? new Date(accepted.acceptedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "today"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Final step · successor verification</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Can {transition.successor} continue the work?</h1>
        <p className="mt-3 text-sm leading-6 text-muted">These five statements describe what the final acceptance means. They are not completed yet. A green check appears only after the successor explicitly accepts the handoff.</p>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted" role="status">{message}</div>}

      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-background/60 px-5 py-3"><p className="text-xs font-medium text-subtle">Acceptance will confirm all five</p></div>
        {SUCCESSOR_REVIEW_CHECKS.map((item, index) => <div key={item.key} className={`flex items-start gap-4 p-5 ${index ? "border-t border-border" : ""}`}><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background text-xs font-semibold text-subtle">{index + 1}</span><div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-sm leading-6 text-subtle">{item.description}</p></div></div>)}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Anything still unclear?</h2>
          <p className="mt-1 text-xs leading-5 text-subtle">Adding a follow-up saves it to this successor review and to the handoff&apos;s open questions. It also keeps the handoff open.</p>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you still need to know?" className="mt-3 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" />
          <button onClick={submitQuestion} disabled={!question.trim()} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-40">Add follow-up</button>
          {review.submittedQuestions.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Saved follow-ups</p><div className="mt-2 space-y-2">{review.submittedQuestions.map((item) => <div key={item} className="rounded-lg bg-background px-3 py-2 text-xs leading-5 text-muted">{item}</div>)}</div></div>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Successor notes</h2><span className={`text-[11px] ${notesDirty ? "text-warning" : "text-subtle"}`}>{notesDirty ? "Unsaved changes" : review.notes ? "Saved to handoff record" : "Optional"}</span></div>
          <p className="mt-1 text-xs leading-5 text-subtle">These notes appear in the permanent handoff record under Successor verification.</p>
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesDirty(event.target.value !== review.notes); }} rows={4} placeholder="Optional notes for the handoff record…" className="mt-3 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none" />
          <button onClick={saveNotes} disabled={!notesDirty} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-40">{notesDirty ? "Save notes" : "Notes saved"}</button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border-strong bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div><p className="text-sm font-medium">Ready to accept the handoff?</p><p className="mt-1 text-xs leading-5 text-subtle">{criticalGaps.length ? `${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? " still blocks" : "s still block"} acceptance.` : notesDirty ? "Save the successor notes first, then complete the handoff." : "Accepting records all five statements as explicitly verified and completes the handoff."}</p></div>
        <div className="mt-4 flex shrink-0 gap-2 sm:mt-0"><button onClick={requestChanges} className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-muted">Request changes</button><motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={accept} disabled={Boolean(criticalGaps.length || notesDirty)} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40">Accept and complete</motion.button></div>
      </div>
    </div>
  );
}
