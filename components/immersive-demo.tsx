"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import { IconAlert, IconCheck, IconChevronRight, IconFile, IconSpark } from "./icons";

type SceneKey = "collect" | "understand" | "gaps" | "verify";

type Scene = {
  key: SceneKey;
  eyebrow: string;
  title: string;
  body: string;
};

const SCENES: Scene[] = [
  {
    key: "collect",
    eyebrow: "01 · Start with the work",
    title: "Don’t ask someone to remember everything from scratch.",
    body: "Understudy starts with the files, repositories, notes, and AI context that already contain pieces of the role.",
  },
  {
    key: "understand",
    eyebrow: "02 · Reconstruct the role",
    title: "Turn scattered artifacts into one view of the work.",
    body: "It connects related evidence into responsibilities, active work, ownership, risks, and contradictions while keeping the source trail visible.",
  },
  {
    key: "gaps",
    eyebrow: "03 · Ask only what is missing",
    title: "Use the human for context the evidence cannot explain.",
    body: "Instead of a generic exit questionnaire, Understudy asks a small number of source-aware questions that matter to continuity.",
  },
  {
    key: "verify",
    eyebrow: "04 · Verify the transfer",
    title: "A handoff is finished when the next owner can continue.",
    body: "The successor reviews the handoff, raises anything still unclear, and explicitly accepts the transfer. That acceptance becomes part of the record.",
  },
];

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/60 bg-white/70 shadow-[0_24px_80px_rgba(28,28,30,0.10)] backdrop-blur-2xl ${className}`}>{children}</div>;
}

export function ImmersiveDemo({ transition }: { transition: Transition }) {
  const reducedMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const scene = SCENES[index];
  const primarySources = transition.sources.filter((source) => source.kind !== "interview");
  const criticalGap = transition.gaps.find((gap) => gap.priority === "Critical") ?? transition.gaps[0];
  const activeProject = transition.projects[0];
  const highRisk = transition.risks.find((risk) => risk.severity === "High") ?? transition.risks[0];

  const progress = useMemo(() => ((index + 1) / SCENES.length) * 100, [index]);

  function next() {
    if (index < SCENES.length - 1) setIndex((value) => value + 1);
  }

  function previous() {
    if (index > 0) setIndex((value) => value - 1);
  }

  const transitionProps = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 330, damping: 30, mass: 0.85 };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f6f8] text-foreground">
      <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-accent/10 blur-[90px]" />
      <div className="pointer-events-none absolute right-[-120px] top-[32%] h-96 w-96 rounded-full bg-ok/10 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-[28%] h-96 w-96 rounded-full bg-warning/10 blur-[120px]" />

      <header className="relative z-20 border-b border-white/60 bg-white/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>Understudy</Link>
          <div className="flex items-center gap-2"><span className="hidden rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-medium text-subtle sm:inline-flex">Interactive demo · fictional data</span><Link href="/new" className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-white">Try it yourself</Link></div>
        </div>
      </header>

      {!started ? (
        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-12 px-5 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:px-8">
          <motion.section initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-sm font-medium text-accent">See the handoff happen.</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] sm:text-6xl">From scattered work to a handoff someone can continue.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">Follow a fictional transition from {transition.person} to {transition.successor}. Four short scenes show what Understudy does and why each step exists.</p>
            <div className="mt-8 flex flex-wrap gap-3"><motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={() => setStarted(true)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white shadow-sm">Start the demo <IconChevronRight /></motion.button><Link href="/" className="inline-flex h-12 items-center rounded-xl border border-white/80 bg-white/55 px-5 text-sm font-medium text-muted backdrop-blur-xl">Back home</Link></div>
          </motion.section>

          <motion.div initial={reducedMotion ? false : { opacity: 0, y: 20, rotateX: 3 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: reducedMotion ? 0 : 0.08, duration: 0.55 }} className="relative [perspective:1200px]">
            <GlassCard className="overflow-hidden p-2">
              <div className="rounded-[22px] border border-border/70 bg-background/90 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Example transition</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{transition.person} → {transition.successor}</h2><p className="mt-1 text-sm text-muted">{transition.role} · {transition.department}</p></div><span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">Demo</span></div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">{primarySources.slice(0, 4).map((source, idx) => <motion.div key={source.id} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : 0.16 + idx * 0.05 }} className="rounded-2xl border border-border bg-card p-4"><IconFile className="h-4 w-4 text-muted" /><p className="mt-3 truncate text-sm font-medium">{source.title}</p><p className="mt-1 text-xs text-subtle">{source.provider}</p></motion.div>)}</div>
                <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-soft p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent"><IconSpark /></span><div><p className="text-sm font-medium">Understudy connects the evidence</p><p className="mt-1 text-xs leading-5 text-subtle">Documents stay separate, but the handoff is reconstructed as one role.</p></div></div></div>
              </div>
            </GlassCard>
          </motion.div>
        </main>
      ) : (
        <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">How Understudy works</p>
              <div className="mt-5 space-y-2">{SCENES.map((item, sceneIndex) => { const active = sceneIndex === index; const complete = sceneIndex < index; return <button key={item.key} onClick={() => setIndex(sceneIndex)} className="relative w-full rounded-2xl p-3 text-left"><AnimatePresence>{active && <motion.span layoutId="demo-scene" className="absolute inset-0 rounded-2xl border border-white/80 bg-white/75 shadow-sm backdrop-blur-xl" transition={transitionProps} />}</AnimatePresence><div className="relative flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${complete ? "border-accent bg-accent text-white" : active ? "border-border-strong bg-white" : "border-white/70 bg-white/35 text-faint"}`}>{complete ? <IconCheck className="h-4 w-4" /> : sceneIndex + 1}</span><div><p className={`text-sm font-medium ${active || complete ? "text-foreground" : "text-subtle"}`}>{item.key === "collect" ? "Collect" : item.key === "understand" ? "Understand" : item.key === "gaps" ? "Fill the gaps" : "Hand over"}</p><p className="mt-0.5 text-xs text-faint">{item.eyebrow.split(" · ")[1]}</p></div></div></button>; })}</div>
              <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/60"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={transitionProps} /></div>
            </aside>

            <section>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={scene.key} initial={reducedMotion ? false : { opacity: 0, y: 16, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reducedMotion ? undefined : { opacity: 0, y: -8, filter: "blur(3px)" }} transition={transitionProps}>
                  <div className="max-w-3xl"><p className="text-sm font-medium text-accent">{scene.eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{scene.title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted">{scene.body}</p></div>

                  <div className="mt-8">
                    {scene.key === "collect" && <GlassCard className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Evidence already in the work</p><p className="mt-1 text-xs text-subtle">Primary files, GitHub activity, and recovered AI context stay distinguishable.</p></div><span className="rounded-full bg-white/70 px-3 py-1 text-xs text-subtle">{primarySources.length} sources</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{primarySources.slice(0, 6).map((source, idx) => <motion.div key={source.id} initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reducedMotion ? 0 : idx * 0.05 }} className={`rounded-2xl border p-4 ${source.kind === "ai-context" ? "border-accent/25 bg-accent-soft" : "border-white/80 bg-white/55"}`}><div className="flex items-center gap-2"><IconFile className="h-4 w-4 text-muted" /><span className="text-xs font-medium text-subtle">{source.kind === "ai-context" ? "AI-recovered" : "Primary evidence"}</span></div><p className="mt-3 text-sm font-medium">{source.title}</p><p className="mt-1 text-xs text-subtle">{source.meta}</p></motion.div>)}</div></GlassCard>}

                    {scene.key === "understand" && <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]"><GlassCard className="p-5 sm:p-6"><div className="flex items-center gap-2"><IconSpark className="text-accent" /><p className="text-sm font-medium">What the role contains</p></div><div className="mt-4 space-y-3">{transition.projects.slice(0, 3).map((project, idx) => <motion.div key={project.name} initial={reducedMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : idx * 0.07 }} className="rounded-2xl border border-white/80 bg-white/55 p-4"><p className="text-sm font-medium">{project.name}</p><p className="mt-1 text-xs text-subtle">{project.state} · {project.ownership}</p></motion.div>)}</div></GlassCard><GlassCard className="p-5 sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning"><IconAlert /></div><p className="mt-4 text-sm font-medium">Continuity risk surfaced</p><p className="mt-2 text-sm leading-6 text-muted">{highRisk?.title}</p><p className="mt-2 text-xs leading-5 text-subtle">{highRisk?.detail}</p></GlassCard></div>}

                    {scene.key === "gaps" && <GlassCard className="overflow-hidden"><div className="border-b border-white/70 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">One question worth asking</p><span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">Critical</span></div><h2 className="mt-5 max-w-3xl text-2xl font-semibold leading-9 tracking-[-0.035em]">{criticalGap?.question}</h2><p className="mt-2 text-sm text-subtle">About {criticalGap?.topic}</p></div><div className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr] sm:p-6"><div className="rounded-2xl border border-white/80 bg-white/55 p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-faint">Why it is being asked</p><p className="mt-2 text-sm leading-6 text-muted">The evidence describes what happened, but not enough of the reasoning the successor needs to make the next decision safely.</p></div><div className="rounded-2xl border border-accent/20 bg-accent-soft p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-accent">Source-aware</p><p className="mt-2 text-sm leading-6 text-muted">The question stays linked to the files that exposed the gap, so the employee can inspect the context before answering.</p></div></div></GlassCard>}

                    {scene.key === "verify" && <GlassCard className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium">Successor verification</p><p className="mt-1 text-xs text-subtle">The transfer is complete only when the successor explicitly accepts it.</p></div><span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">Pending acceptance</span></div><div className="mt-5 grid gap-2">{["I understand the role scope", "I understand the active work", "I know what I own", "I reviewed the continuity risks", "I reviewed the open questions"].map((label, idx) => <motion.div key={label} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : idx * 0.05 }} className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-xs text-subtle">{idx + 1}</span><p className="text-sm text-muted">{label}</p></motion.div>)}</div><div className="mt-5 flex items-center justify-between rounded-2xl border border-ok/20 bg-ok/5 p-4"><div><p className="text-sm font-medium">The end state is explicit.</p><p className="mt-1 text-xs text-subtle">Acceptance creates the verified record. It is not inferred from an AI score.</p></div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok text-white"><IconCheck /></span></div></GlassCard>}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-3"><button onClick={previous} disabled={index === 0} className="h-11 rounded-lg border border-white/80 bg-white/55 px-4 text-sm font-medium text-muted backdrop-blur-xl disabled:opacity-30">Back</button>{index < SCENES.length - 1 ? <motion.button whileTap={reducedMotion ? undefined : { scale: 0.98 }} onClick={next} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Next <IconChevronRight /></motion.button> : <Link href="/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Start a real handoff <IconChevronRight /></Link>}</div>
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
