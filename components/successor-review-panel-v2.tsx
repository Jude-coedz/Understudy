"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, saveWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { applyReviewMetric, SUCCESSOR_REVIEW_CHECKS, type SuccessorReview, type SuccessorReviewCheckKey } from "@/lib/successor-review";
import { IconAsk, IconCheck, IconChevronRight, IconMessage } from "./icons";

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
  const [notes, setNotes] = useState("");
  const [concernKey, setConcernKey] = useState<SuccessorReviewCheckKey | null>(null);
  const [concernText, setConcernText] = useState("");
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
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-warning">{raisedDuringReview ? "Successor follow-up saved" : "Missing context still open"}</p>
        <h1 className="mt-2 text-2xl font-semibold">{raisedDuringReview ? "The handoff has reopened." : "Finish the missing context first."}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{raisedDuringReview ? "The question you raised is stored in the successor review and has also become a blocking open question in the context review. It must be addressed before acceptance." : "Successor verification is the final step, not a shortcut around unresolved handoff context."}</p>
        {raisedDuringReview && <div className="mx-auto mt-5 max-w-lg rounded-xl border border-border bg-card p-4 text-left"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Latest follow-up</p><p className="mt-2 text-sm leading-6 text-muted">{followups[followups.length - 1]}</p></div>}
        <Link href="/workspace" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">{raisedDuringReview ? "Resolve missing context" : "Back to missing context"} <IconChevronRight /></Link>
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

  function confirmCheck(key: SuccessorReviewCheckKey) {
    const now = new Date().toISOString();
    persist({
      ...review,
      status: "pending",
      acceptedAt: undefined,
      updatedAt: now,
      checks: { ...review.checks, [key]: true },
    });
    setConcernKey(null);
    setConcernText("");
    setMessage("");
  }

  function resetCheck(key: SuccessorReviewCheckKey) {
    const now = new Date().toISOString();
    persist({
      ...review,
      status: "pending",
      acceptedAt: undefined,
      updatedAt: now,
      checks: { ...review.checks, [key]: false },
    });
    setMessage("");
  }

  function openConcern(key: SuccessorReviewCheckKey) {
    setConcernKey(key);
    setConcernText("");
    setMessage("");
  }

  function submitConcern() {
    const text = concernText.trim();
    if (!text || !concernKey) return;
    const area = SUCCESSOR_REVIEW_CHECKS.find((item) => item.key === concernKey);
    const questionText = area ? area.label + ": " + text : text;
    const now = new Date().toISOString();
    const next: SuccessorReview = {
      ...review,
      status: "changes-requested",
      acceptedAt: undefined,
      updatedAt: now,
      notes: notes.trimEnd(),
      notesSavedAt: notes.trim() ? now : review.notesSavedAt,
      checks: { ...review.checks, [concernKey]: false },
      submittedQuestions: [...new Set([...review.submittedQuestions, questionText])],
    };
    persist(next, questionText);
    setConcernKey(null);
    setConcernText("");
    setNotes(next.notes);
    setNotesDirty(false);
  }

  function saveNotes() {
    const saved = notes.trimEnd();
    const now = new Date().toISOString();
    persist({ ...review, notes: saved, notesSavedAt: now, updatedAt: now });
    setNotes(saved);
    setNotesDirty(false);
    setMessage(saved ? "Your note is saved with the permanent handoff record." : "Successor notes cleared.");
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
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">This records the next owner&apos;s own readiness check. It is not an AI score, a performance rating, or HR approval.</p>
        <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-ok/20 bg-ok/5 p-4 text-left">
          {SUCCESSOR_REVIEW_CHECKS.map((item) => <div key={item.key} className="flex items-center gap-3 py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok text-white"><IconCheck className="h-3.5 w-3.5" /></span><div><p className="text-sm font-medium">{item.label}</p><p className="mt-0.5 text-xs leading-5 text-subtle">Confirmed by the successor</p></div></div>)}
        </div>
        {accepted.notes && <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-border bg-card p-4 text-left"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Successor note saved with this record</p><p className="mt-2 text-sm leading-6 text-muted">{accepted.notes}</p></div>}
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/handoffs" className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-white">Back to my handoffs</Link><Link href="/record" className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-muted">View handoff record</Link></div>
        <p className="mt-5 text-xs text-subtle">Accepted {accepted.acceptedAt ? new Date(accepted.acceptedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "today"}</p>
      </div>
    );
  }

  const confirmedCount = SUCCESSOR_REVIEW_CHECKS.filter((item) => review.checks[item.key]).length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="rounded-[26px] border border-accent/15 bg-accent-soft/45 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">For the next owner · {transition.successor}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Can you continue the work without {transition.person}?</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              This is your readiness check as the successor. Review the handoff, ask questions, then confirm each area only when you could genuinely take over. If something is unclear, raise a concern and Understudy sends it back to {transition.person} as a blocking question.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/record" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-muted"><IconMessage className="h-4 w-4" /> Review handoff</Link>
            <Link href="/ask" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-xs font-semibold text-muted"><IconAsk className="h-4 w-4" /> Ask Understudy</Link>
          </div>
        </div>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted" role="status">{message}</div>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Readiness check</p>
          <p className="mt-1 text-xs text-subtle">Each confirmation means “I can take responsibility for this area now.”</p>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted">{confirmedCount} of {SUCCESSOR_REVIEW_CHECKS.length} ready</span>
      </div>

      <div className="mt-4 space-y-3">
        {SUCCESSOR_REVIEW_CHECKS.map((item, index) => {
          const checked = review.checks[item.key];
          const concernOpen = concernKey === item.key;
          return (
            <motion.section
              key={item.key}
              layout
              className={checked ? "overflow-hidden rounded-2xl border border-ok/20 bg-ok/5" : concernOpen ? "overflow-hidden rounded-2xl border border-warning/25 bg-warning/5" : "overflow-hidden rounded-2xl border border-border bg-card"}
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className={checked ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ok/25 bg-ok text-xs font-semibold text-white" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background text-xs font-semibold text-subtle"}>
                  {checked ? <IconCheck className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-subtle">{item.description}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {checked ? (
                    <>
                      <span className="inline-flex h-9 items-center rounded-lg bg-ok/10 px-3 text-xs font-semibold text-ok">I can continue</span>
                      <button onClick={() => resetCheck(item.key)} className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-subtle">Change</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => confirmCheck(item.key)} className="h-9 rounded-lg bg-accent px-3.5 text-xs font-semibold text-white">I can continue</button>
                      <button onClick={() => openConcern(item.key)} className="h-9 rounded-lg border border-border px-3.5 text-xs font-semibold text-muted">I need clarification</button>
                    </>
                  )}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {concernOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="border-t border-warning/20 bg-background/65 p-5">
                      <p className="text-sm font-semibold">What is unclear?</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">
                        Understudy adds this concern to the handoff and reopens it for {transition.person}. HR is not required unless your company chooses to involve them separately.
                      </p>
                      <textarea
                        value={concernText}
                        onChange={(event) => setConcernText(event.target.value)}
                        rows={4}
                        placeholder={"Tell " + transition.person + " exactly what you need before you can take over this area…"}
                        className="mt-3 w-full resize-none rounded-xl border border-border bg-card p-3 text-sm leading-6 outline-none"
                      />
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button onClick={() => { setConcernKey(null); setConcernText(""); }} className="h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted">Cancel</button>
                        <button onClick={submitConcern} disabled={!concernText.trim()} className="h-9 rounded-lg bg-warning px-3.5 text-xs font-semibold text-white disabled:opacity-40">Send back to {transition.person}</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Optional note for the permanent record</h2>
            <p className="mt-1 text-xs leading-5 text-subtle">Use this for context you want future readers to see. It does not change the reconstructed evidence.</p>
          </div>
          <span className={notesDirty ? "text-[11px] text-warning" : "text-[11px] text-subtle"}>{notesDirty ? "Unsaved" : review.notes ? "Saved" + (review.notesSavedAt ? " · " + savedTime(review.notesSavedAt) : "") : "Optional"}</span>
        </div>
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesDirty(event.target.value !== review.notes); }} onBlur={() => { if (notesDirty) saveNotes(); }} rows={3} placeholder="Anything worth preserving for the next person after you…" className="mt-3 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none" />
      </div>

      <div className="mt-6 rounded-2xl border border-border-strong bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <p className="text-sm font-semibold">Complete the transfer</p>
          <p className="mt-1 text-xs leading-5 text-subtle">
            {criticalGaps.length
              ? criticalGaps.length + " critical concern" + (criticalGaps.length === 1 ? " still blocks" : "s still block") + " acceptance."
              : notesDirty
                ? "Save your note first."
                : !allChecksComplete
                  ? "Confirm the remaining " + (SUCCESSOR_REVIEW_CHECKS.length - confirmedCount) + " readiness area" + (SUCCESSOR_REVIEW_CHECKS.length - confirmedCount === 1 ? "" : "s") + " first."
                  : "Everything is clear enough for " + transition.successor + " to take over."}
          </p>
        </div>
        <motion.button
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
          onClick={() => setShowAcceptConfirm(true)}
          disabled={Boolean(criticalGaps.length || notesDirty || !allChecksComplete)}
          className="mt-4 h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-40 sm:mt-0"
        >
          Accept handoff
        </motion.button>
      </div>

      <AnimatePresence>
        {showAcceptConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/20 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAcceptConfirm(false); }}>
            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.99 }} transition={{ type: "spring", stiffness: 360, damping: 30 }} className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">Final acceptance</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Confirm that you can take over?</h2>
              <p className="mt-2 text-sm leading-6 text-muted">This records that {transition.successor}, the next owner, reviewed the transfer and can continue the work. It does not certify performance or require HR approval.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAcceptConfirm(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-muted">Not yet</button>
                <button type="button" onClick={confirmAccept} className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-white">Yes, accept handoff</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
