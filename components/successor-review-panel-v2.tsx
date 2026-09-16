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
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = () => {
      const current = getCurrentWorkspace();
      setWorkspace(current);
      setNotes(current?.successorReview?.notes ?? "");
    };
    refresh();
    window.addEventListener("understudy:cloud-hydrated", refresh);
    return () => window.removeEventListener("understudy:cloud-hydrated", refresh);
  }, []);

  const criticalGaps = useMemo(
    () => workspace?.transition.gaps.filter((gap) => gap.priority === "Critical" && workspace.interviewGapStates[gap.question]?.status !== "not-relevant") ?? [],
    [workspace],
  );

  if (!workspace) {
    return <div className="mx-auto max-w-2xl px-5 py-16 text-center"><h1 className="text-2xl font-semibold">No handoff selected.</h1><p className="mt-2 text-sm text-muted">Choose a handoff before successor verification.</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white">My handoffs</Link></div>;
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
      ? { ...current.transition, gaps: [...current.transition.gaps, { question: text, topic: "Successor review", priority: "Important" as const }].filter((item, index, all) => all.findIndex((candidate) => candidate.question.toLowerCase() === item.question.toLowerCase()) === index) }
      : current.transition;
    const transitionWithMetric = applyReviewMetric(transitionWithGap, nextReview);
    const next: PersonalWorkspace = { ...current, updatedAt: new Date().toISOString(), transition: transitionWithMetric, successorReview: nextReview };
    setWorkspace(next);
    saveWorkspace(next);
  }

  function saveNotes() {
    const next = { ...review, notes, updatedAt: new Date().toISOString() };
    persist(next);
    setMessage("Notes saved.");
  }

  function submitQuestion() {
    const text = question.trim();
    if (!text) return;
    const next: SuccessorReview = { ...review, status: "changes-requested", acceptedAt: undefined, updatedAt: new Date().toISOString(), notes, submittedQuestions: [...new Set([...review.submittedQuestions, text])] };
    persist(next, text);
    setQuestion("");
    setMessage("Question added. The handoff stays open until the team resolves it.");
  }

  function requestChanges() {
    persist({ ...review, status: "changes-requested", acceptedAt: undefined, notes, updatedAt: new Date().toISOString() });
    setMessage("Changes requested. The handoff remains open.");
  }

  function accept() {
    if (criticalGaps.length) {
      setMessage(`Resolve ${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? "" : "s"} before acceptance.`);
      return;
    }
    const now = new Date().toISOString();
    const checks = Object.fromEntries(SUCCESSOR_REVIEW_CHECKS.map((item) => [item.key, true])) as SuccessorReview["checks"];
    persist({ ...review, status: "accepted", reviewerName: transition.successor || review.reviewerName, notes, checks, acceptedAt: now, updatedAt: now });
    setMessage("");
  }

  if (workspace.successorReview?.status === "accepted") {
    const accepted = workspace.successorReview;
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 text-center lg:px-8 lg:py-20">
        <motion.span initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-7 w-7" /></motion.span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-ok">Handoff complete</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{transition.successor} accepted the handoff.</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">The successor made one explicit acceptance covering scope, active work, ownership, continuity risks, and open follow-ups.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/" className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-white">Back to my handoffs</Link><Link href="/record" className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-medium text-muted">View handoff record</Link></div>
        <p className="mt-5 text-xs text-subtle">Accepted {accepted.acceptedAt ? new Date(accepted.acceptedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "today"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Final step · successor verification</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Can {transition.successor} continue the work?</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Read the five things this acceptance covers. You no longer have to click five separate controls. One final confirmation records the successor&apos;s explicit acceptance of all five.</p>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted">{message}</div>}

      <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {SUCCESSOR_REVIEW_CHECKS.map((item, index) => <div key={item.key} className={`flex items-start gap-4 p-5 ${index ? "border-t border-border" : ""}`}><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ok/30 bg-ok/5 text-ok"><IconCheck className="h-3.5 w-3.5" /></span><div><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-sm leading-6 text-subtle">{item.description}</p></div></div>)}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm font-medium">Anything still unclear?</h2><p className="mt-1 text-xs leading-5 text-subtle">Ask a question instead of accepting something you do not understand.</p><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you still need to know?" className="mt-3 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" /><button onClick={submitQuestion} disabled={!question.trim()} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted disabled:opacity-40">Add follow-up</button></div>
        <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm font-medium">Successor notes</h2><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Optional notes for the handoff record…" className="mt-3 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none" /><button onClick={saveNotes} className="mt-2 h-9 rounded-lg border border-border px-3 text-xs font-medium text-muted">Save notes</button></div>
      </div>

      <div className="mt-6 rounded-2xl border border-border-strong bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div><p className="text-sm font-medium">Ready to accept the handoff?</p><p className="mt-1 text-xs leading-5 text-subtle">{criticalGaps.length ? `${criticalGaps.length} critical follow-up${criticalGaps.length === 1 ? " still blocks" : "s still block"} acceptance.` : "This single action records all five verification checks and completes the handoff."}</p></div>
        <div className="mt-4 flex shrink-0 gap-2 sm:mt-0"><button onClick={requestChanges} className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-muted">Request changes</button><motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={accept} disabled={Boolean(criticalGaps.length)} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40">Accept and complete</motion.button></div>
      </div>
    </div>
  );
}
