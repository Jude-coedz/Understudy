"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import { IconAlert, IconCheck, IconChevronRight, IconFile, IconSpark } from "./icons";

type DemoStep = "collect" | "reconstruct" | "gaps" | "handoff" | "verify";

const STEPS: Array<{ key: DemoStep; label: string; title: string; body: string; why: string }> = [
  {
    key: "collect",
    label: "01 · Collect",
    title: "Start with the work that already exists.",
    body: "Understudy keeps every source separate first: PRDs, roadmaps, GitHub activity, Drive files, and recovered AI context. Nothing is treated as the whole truth on its own.",
    why: "The handoff should begin with evidence, not a blank questionnaire.",
  },
  {
    key: "reconstruct",
    label: "02 · Understand",
    title: "Connect the evidence into one role model.",
    body: "The system compares sources, reconstructs active work and ownership, then keeps provenance attached so primary evidence can outweigh lower-confidence recovered context.",
    why: "A pile of files is not yet a handoff. The successor needs a coherent model of the work.",
  },
  {
    key: "gaps",
    label: "03 · Fill the gaps",
    title: "Ask only what the evidence cannot explain.",
    body: "Understudy prioritizes continuity-critical questions instead of forcing the departing person through a generic exit interview.",
    why: "Human time should be spent on tacit knowledge, missing rationale, and unresolved ownership.",
  },
  {
    key: "handoff",
    label: "04 · Hand over",
    title: "Turn the reviewed knowledge into something usable.",
    body: "The handoff brings together role scope, active work, risks, ownership, open follow-ups, and evidence-grounded Ask Understudy in one place.",
    why: "The output should help someone continue the work, not simply archive what the old owner knew.",
  },
  {
    key: "verify",
    label: "05 · Verify",
    title: "Finish only when the successor can continue.",
    body: "The successor can raise remaining questions, leave notes, and explicitly accept the transfer. Green verification appears only after that explicit acceptance.",
    why: "Completion should mean continuity was verified, not that someone clicked through a checklist.",
  },
];

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/40 bg-card/75 shadow-[0_24px_80px_rgba(30,45,70,0.10)] backdrop-blur-2xl ${className}`}>{children}</div>;
}

export function ProductDemo({ transition }: { transition: Transition }) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const evidence = transition.sources.filter((source) => source.kind !== "interview");
  const primary = evidence.filter((source) => source.kind === "document" || source.kind === "github");
  const aiContext = evidence.filter((source) => source.kind === "ai-context");
  const criticalGaps = transition.gaps.filter((gap) => gap.priority === "Critical");

  const progress = useMemo(() => ((index + 1) / STEPS.length) * 100, [index]);

  function go(next: number) {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-accent/12 blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-ok/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-warning/10 blur-3xl" />

      <header className="relative z-20 border-b border-white/30 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-background">U</span>Understudy</Link>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-accent/15 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent sm:inline-flex">Guided demo · fictional data</span><Link href="/new" className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background">Try the real product</Link></div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-7 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card/70"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 220, damping: 28 }} /></div>
          <span className="text-xs font-medium text-subtle">{index + 1} / {STEPS.length}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <GlassCard className="p-6 lg:sticky lg:top-24">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step.key} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{step.label}</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">{step.title}</h1>
                <p className="mt-4 text-sm leading-7 text-muted">{step.body}</p>
                <div className="mt-5 rounded-2xl border border-border bg-background/65 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Why it matters</p><p className="mt-2 text-sm leading-6 text-muted">{step.why}</p></div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className="h-10 rounded-lg border border-border bg-background/60 px-3.5 text-sm font-medium text-muted disabled:opacity-30">Back</button>
              {index < STEPS.length - 1 ? <button type="button" onClick={() => go(index + 1)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white">Next <IconChevronRight /></button> : <Link href="/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white">Start a handoff <IconChevronRight /></Link>}
            </div>
          </GlassCard>

          <GlassCard className="relative min-h-[650px] overflow-hidden p-4 sm:p-6 lg:p-8">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/25 to-transparent" />
            <div className="relative mb-6 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">{transition.person} → {transition.successor}</p><p className="mt-0.5 text-xs text-subtle">{transition.role} handoff</p></div><span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-subtle">Demo workspace</span></div>

            <AnimatePresence mode="wait" initial={false}>
              {step.key === "collect" && <motion.div key="collect" initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-2xl font-semibold">{evidence.length}</p><p className="mt-1 text-xs text-subtle">evidence sources</p></div><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-2xl font-semibold">{primary.length}</p><p className="mt-1 text-xs text-subtle">primary sources</p></div><div className="rounded-2xl border border-accent/20 bg-accent-soft p-4"><p className="text-2xl font-semibold text-accent">{aiContext.length}</p><p className="mt-1 text-xs text-subtle">AI-recovered source</p></div></div>
                <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background/60">{evidence.map((source, sourceIndex) => <motion.div key={source.id} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sourceIndex * 0.05 }} className={`flex items-center gap-3 p-4 ${sourceIndex ? "border-t border-border" : ""}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${source.kind === "ai-context" ? "bg-accent-soft text-accent" : "bg-card text-muted"}`}>{source.kind === "ai-context" ? <IconSpark /> : <IconFile />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.title}</p><p className="mt-0.5 text-xs text-subtle">{source.provider} · {source.confidence}</p></div>{source.kind === "ai-context" && <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent">Included with documents</span>}</motion.div>)}</div>
              </motion.div>}

              {step.key === "reconstruct" && <motion.div key="reconstruct" initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5"><div className="flex items-center gap-2"><IconSpark className="text-accent" /><p className="text-sm font-medium">Role reconstruction</p></div><p className="mt-3 text-sm leading-7 text-muted">{transition.summary}</p></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">{transition.projects.map((project, projectIndex) => <motion.div key={project.name} initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: projectIndex * 0.06 }} className="rounded-2xl border border-border bg-background/70 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{project.name}</p><span className="text-xs font-medium text-accent">{project.evidence}%</span></div><p className="mt-2 text-xs text-subtle">{project.state}</p><p className="mt-1 text-xs text-muted">Ownership: {project.ownership}</p></motion.div>)}</div>
                <p className="mt-4 text-xs leading-5 text-subtle">Evidence confidence stays visible so a reconstructed claim never silently becomes source-of-truth.</p>
              </motion.div>}

              {step.key === "gaps" && <motion.div key="gaps" initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium">Adaptive interview</p><p className="mt-1 text-xs text-subtle">Only unresolved continuity questions remain.</p></div><span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">{criticalGaps.length} critical</span></div>
                <div className="mt-5 space-y-3">{transition.gaps.map((gap, gapIndex) => <motion.div key={gap.question} animate={gapIndex === 0 && !reducedMotion ? { scale: [1, 1.015, 1] } : undefined} transition={{ repeat: gapIndex === 0 ? Infinity : 0, duration: 2.2 }} className={`rounded-2xl border p-5 ${gapIndex === 0 ? "border-accent/30 bg-accent-soft shadow-sm" : "border-border bg-background/70"}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-subtle">{gap.topic}</span><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${gap.priority === "Critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{gap.priority}</span></div><p className="mt-3 text-sm font-medium leading-6">{gap.question}</p>{gapIndex === 0 && <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted">Answer</span><span className="rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted">Ask someone else</span><span className="rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted">Not relevant</span></div>}</motion.div>)}</div>
              </motion.div>}

              {step.key === "handoff" && <motion.div key="handoff" initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xl font-semibold">{transition.projects.length}</p><p className="mt-1 text-xs text-subtle">active work items</p></div><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xl font-semibold">{transition.risks.length}</p><p className="mt-1 text-xs text-subtle">continuity risks</p></div><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-xl font-semibold">{transition.gaps.length}</p><p className="mt-1 text-xs text-subtle">open follow-ups</p></div></div>
                <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-subtle">Handoff draft</p><h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">{transition.role}</h3><p className="mt-3 text-sm leading-7 text-muted">{transition.summary}</p><div className="mt-5 border-t border-border pt-4"><p className="text-sm font-medium">Next work to continue</p>{transition.projects.slice(0, 3).map((project) => <div key={project.name} className="mt-3 flex items-center justify-between gap-3"><span className="text-sm text-muted">{project.name}</span><span className="text-xs text-subtle">{project.state}</span></div>)}</div></div>
                <motion.div animate={reducedMotion ? undefined : { y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-accent"><IconSpark /></span><div><p className="text-sm font-medium">Ask Understudy stays inside the handoff</p><p className="mt-1 text-xs text-subtle">Answers are grounded in this evidence set and show the sources used.</p></div></motion.div>
              </motion.div>}

              {step.key === "verify" && <motion.div key="verify" initial={reducedMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                <div className="text-center"><motion.span initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 20 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-6 w-6" /></motion.span><h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Verification is explicit.</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">The successor reviews what acceptance means, raises anything still unclear, leaves notes that stay with the record, then accepts when they can continue.</p></div>
                <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-2xl border border-border bg-background/70">{["I understand the role scope", "I understand the active work", "I know what I own", "I reviewed the continuity risks", "I reviewed the open questions"].map((label, itemIndex) => <div key={label} className={`flex items-center gap-3 p-4 ${itemIndex ? "border-t border-border" : ""}`}><span className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-card text-xs font-semibold text-subtle">{itemIndex + 1}</span><span className="text-sm text-muted">{label}</span></div>)}</div>
                <div className="mx-auto mt-5 grid max-w-2xl gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-sm font-medium">Still unclear?</p><p className="mt-1 text-xs leading-5 text-subtle">A follow-up becomes part of the handoff record and keeps the transfer open.</p></div><div className="rounded-2xl border border-border bg-background/70 p-4"><p className="text-sm font-medium">Successor notes</p><p className="mt-1 text-xs leading-5 text-subtle">Saved notes remain attached to the permanent verification record.</p></div></div>
                <div className="mx-auto mt-5 flex max-w-2xl items-center justify-between rounded-2xl border border-ok/20 bg-ok/5 p-4"><div className="flex items-center gap-3"><IconCheck className="text-ok" /><div><p className="text-sm font-medium">Accept and complete</p><p className="text-xs text-subtle">Only this explicit action turns verification green.</p></div></div><IconChevronRight className="text-ok" /></div>
              </motion.div>}
            </AnimatePresence>
          </GlassCard>
        </div>

        <div className="mt-7 text-center"><p className="text-xs text-subtle">This demo uses fictional data to explain the product. It does not create or modify a real handoff.</p></div>
      </main>
    </div>
  );
}
