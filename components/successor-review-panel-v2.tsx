"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, saveWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { applyReviewMetric, SUCCESSOR_REVIEW_CHECKS, type SuccessorReview, type SuccessorReviewCheckKey } from "@/lib/successor-review";
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

function savedTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}

export function SuccessorReviewPanelV2() {
  const reducedMotion = useReducedMotion();
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);

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
    const followups = workspace.successorReview?.submittedQuestions ?? [];
    const raisedDuringReview = followups.length > 0;
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-warning">{raisedDuringReview ? "Successor follow-up saved" : "Gap review not finished"}</p>
        <h1 className="mt-2 text-2xl font-semibold">{raisedDuringReview ? "The handoff has reopened." : "Finish Step 3 first."}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{raisedDuringReview ? "The question you raised is stored in the successor review and has also become a blocking open question in Step 3. It must be addressed before acceptance." : "Successor verification is the final step, not a shortcut around unresolved handoff context."}</p>
        {raisedDuringReview && <div className="mx-auto mt-5 max-w-lg rounded-xl border border-border bg-card p-4 text-left"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Latest follow-up</p><p className="mt-2 text-sm leading-6 text-muted">{followups[followups.length - 1]}</p></div>}
        <Link href="/workspace" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">{raisedDuringReview ? "Resolve it in Step 3" : "Back to gap review"} <IconChevronRight /></Link>
      </div>
    );
  }

  const current = workspace;
  const transition = current.transition;
  const review = reviewFor(current);
  const allChecksComplete = SUCCESSOR_REVIEW_CHECKS.every((item) => review.checks[item.key]);

  function persist(nextReview: SuccessorReview, extraGap?: string) {
    const text = extraGap?.trim();
    const transitionWithGap = text
      ? {
          ...current.transition,
          gaps: [...current.transition.gaps, { question: text, topic: "Successor review", priority: "Critical" as const }]
            .filter((item, index, all) => all.findIndex((candidate) => candidate.question.toLowerCase() === item.question.toLowerCase()) === index),
        }
      : current.transition;
    const transitionWithMetric = applyReviewMetric(transitionWithGap, nextReview);
    const next: PersonalWorkspace = {
      ...current,
      updatedAt: new Date().toISOString(),
      transition: transitionWithMetric,
      successorReview: nextReview,
      interviewCompletedAt: text ? undefined : current.interviewCompletedAt,
    };
    setWorkspace(next);
    saveWorkspace(next);
    return next;
  }

  function toggleCheck(key: SuccessorReviewCheckKey) {
    const now = new Date().toISOString();
    persist({
      ...review,
      status: "pending",
      acceptedAt: undefined,
      updatedAt: now,
      checks: { ...review.checks, [key]: !review.checks[key] },
    });
    setMessage("");
  }

  function saveNotes() {
    const saved = notes.trimEnd();
    const now = new Date().toISOString();
    persist({ ...review, notes: saved, notesSavedAt: now, updatedAt: now });
    setNotes(saved);
    setNotesDirty(false);
    setMessage(saved ? "Successor notes saved to the permanent handoff record." : "Successor notes cleared from the handoff record.");
  }

  function submitQuestion() {
    const text = question.trim();
    if (!text) return;
    const now = new Date().toISOString();
    const next: SuccessorReview = {
      ...review,
      status: "changes-requested",
      acceptedAt: undefined,
      updatedAt: now,
      notes: notes.trimEnd(),
      notesSavedAt: notes.trim() ? now : review.notesSavedAt,
      submittedQuestions: [...new Set([...review.submittedQuestions, text])],
    };
    persist(next, text);
    setQuestion("");
    setNotes(next.notes);
    setNotesDirty(false);
  }

  function requestChanges() {
    const now = new Date().toISOString();
    persist({ ...review, status: "changes-requested", acceptedAt: undefined, notes: notes.trimEnd(), notesSavedAt: notes.trim() ? now : review.notesSavedAt, updatedAt: now });
    setNotesDirty(false);
    setMessage("Changes requested. This review is saved and the handoff remains open.");
  }

  function confirmAccept() {
    if (criticalGaps.length) {
      setShowAcceptConfirm(false);
      setMessage(`Resolve ${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? "" : "s"} before acceptance.`);
      return;
    }
    if (!allChecksComplete) {
      setShowAcceptConfirm(false);
      setMessage("Confirm all five acceptance criteria before completing the handoff.");
      return;
    }
    const now = new Date().toISOString();
    persist({
      ...review,
      status: "accepted",
      reviewerName: transition.successor || review.reviewerName,
      notes: notes.trimEnd(),
      notesSavedAt: notes.trim() ? now : review.notesSavedAt,
      checks: review.checks,
      acceptedAt: now,
      updatedAt: now,
    });
    setNotesDirty(false);
    setShowAcceptConfirm(false);
    setMessage("");
  }

  if (workspace.successorReview?.status === "accepted") {
    const accepted = workspace.successorReview;
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 text-center lg:px-8 lg:py-20">
        <motion.span initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-7 w-7" /></motion.span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ok">Handoff complete</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{transition.successor} accepted the handoff.</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">A green tick means the successor explicitly confirmed that statement when they accepted the handoff. It is not an AI score or an automatic verification.</p>
        <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-ok/20 bg-ok/5 p-4 text-left">
          {SUCCESSOR_REVIEW_CHECKS.map((item) => <div key={item.key} className="flex items-center gap-3 py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white"><IconCheck className="h-3.5 w-3.5" /></span><div><p className="text-sm font-medium">{item.label}</p><p className="mt-0.5 text-xs leading-5 text-subtle">Explicitly verified on acceptance</p></div></div>)}
        </div>
        {accepted.notes && <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-border bg-card p-4 text-left"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Successor note saved with this record</p><p className="mt-2 text-sm leading-6 text-muted">{accepted.notes}</p></div>}
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
        <p className="mt-3 text-sm leading-6 text-muted">These are the five statements the successor will explicitly confirm with one final acceptance. Until then, none of them are marked verified.</p>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted" role="status">{message}</div>}

      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-background/60 px-5 py-3">
          <p className="text-xs font-medium text-subtle">Acceptance criteria · confirm each one</p>
          <p className="mt-1 text-[11px] leading-5 text-faint">These are successor confirmations, not AI scores. Review the handoff, then mark each statement when it is genuinely true.</p>
        </div>
        {SUCCESSOR_REVIEW_CHECKS.map((item, index) => {
          const checked = review.checks[item.key];
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={checked}
              onClick={() => toggleCheck(item.key)}
              className={`flex w-full items-start gap-4 p-5 text-left ${index ? "border-t border-border" : ""} ${checked ? "bg-ok/5" : "bg-card"}`}
            >
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${checked ? "border-ok/25 bg-ok text-white" : "border-border-strong bg-background text-subtle"}`}>
                {checked ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-1 block text-sm leading-6 text-subtle">{item.description}</span>
              </span>
              <span className={`ml-auto shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${checked ? "border-ok/20 bg-ok/10 text-ok" : "border-border bg-background text-faint"}`}>
                {checked ? "Confirmed" : "Pending"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Raise a follow-up</h2>
          <p className="mt-1 text-xs leading-5 text-subtle">This field creates a question, not an answer. Saving it adds the question to this review and to the handoff&apos;s open gaps, then reopens Step 3 so the current owner can answer it.</p>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What must be clarified before you take ownership?" className="mt-3 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" />
          <button onClick={submitQuestion} disabled={!question.trim()} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-40">Save follow-up and reopen Step 3</button>
          {review.submittedQuestions.length > 0 && <div className="mt-4 border-t border-border pt-3"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Saved in this review</p><div className="mt-2 space-y-2">{review.submittedQuestions.map((item) => <div key={item} className="rounded-lg bg-background px-3 py-2 text-xs leading-5 text-muted">{item}</div>)}</div></div>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Successor notes</h2><span className={`text-[11px] ${notesDirty ? "text-warning" : "text-subtle"}`}>{notesDirty ? "Unsaved changes" : review.notes ? `Saved${review.notesSavedAt ? ` · ${savedTime(review.notesSavedAt)}` : ""}` : "Optional"}</span></div>
          <p className="mt-1 text-xs leading-5 text-subtle">Saved notes become part of the permanent handoff record under Successor verification. They are not fed back into the evidence reconstruction.</p>
          <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesDirty(event.target.value !== review.notes); }} onBlur={() => { if (notesDirty) saveNotes(); }} rows={4} placeholder="Optional notes for the handoff record…" className="mt-3 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none" />
          <button onClick={saveNotes} disabled={!notesDirty} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-40">{notesDirty ? "Save notes now" : review.notes ? "Notes saved to record" : "No notes to save"}</button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border-strong bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div><p className="text-sm font-medium">Ready to accept the handoff?</p><p className="mt-1 text-xs leading-5 text-subtle">{criticalGaps.length ? `${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? " still blocks" : "s still block"} acceptance.` : notesDirty ? "Save the successor notes first, then complete the handoff." : !allChecksComplete ? "Confirm each acceptance criterion above before the final handoff acceptance." : "All five criteria are confirmed. You will get one final confirmation before the handoff is completed."}</p></div>
        <div className="mt-4 flex shrink-0 gap-2 sm:mt-0"><button onClick={requestChanges} className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-muted">Request changes</button><motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={() => setShowAcceptConfirm(true)} disabled={Boolean(criticalGaps.length || notesDirty || !allChecksComplete)} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40">Review & accept</motion.button></div>
      </div>

      <AnimatePresence>
        {showAcceptConfirm && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/20 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAcceptConfirm(false); }}><motion.div initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.99 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl"><p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">Final acceptance</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Confirm the transfer?</h2><p className="mt-2 text-sm leading-6 text-muted">By accepting, {transition.successor} finalizes the five criteria already confirmed above and completes the transfer.</p><div className="mt-4 space-y-2">{SUCCESSOR_REVIEW_CHECKS.map((item) => <div key={item.key} className="flex items-start gap-2 rounded-xl bg-background px-3 py-2.5"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-subtle">✓</span><p className="text-xs leading-5 text-muted">{item.label}</p></div>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowAcceptConfirm(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted">Not yet</button><button type="button" onClick={confirmAccept} className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white">Accept handoff</button></div></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
