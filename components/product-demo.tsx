"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import {
  IconAsk,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconMessage,
  IconSpark,
  IconTransition,
} from "./icons";
import { UnderstudyMark } from "./understudy-mark";

type DemoStep =
  | "create"
  | "collect"
  | "reconstruct"
  | "gaps"
  | "record"
  | "ask"
  | "verify"
  | "return";

type Step = {
  key: DemoStep;
  label: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    key: "create",
    label: "01 · Start",
    title: "Set up the handoff.",
    body: "Tell Understudy whose work is changing hands, what role they own, who is taking over, and when the transfer should be ready.",
  },
  {
    key: "collect",
    label: "02 · Bring the work",
    title: "Use what already exists.",
    body: "Add files, Google Drive documents, recovered AI context, and the employee's own explanation. They can type or dictate what never made it into a document.",
  },
  {
    key: "reconstruct",
    label: "03 · Understand",
    title: "Understudy connects the evidence.",
    body: "AI reconstructs the role across the whole evidence set: responsibilities, active work, decisions, ownership, risks, and where the sources disagree.",
  },
  {
    key: "gaps",
    label: "04 · Fill gaps",
    title: "Ask only what is still missing.",
    body: "Instead of a generic exit questionnaire, Understudy asks targeted questions about the context a successor would otherwise have to rediscover.",
  },
  {
    key: "record",
    label: "05 · Hand over",
    title: "Give the next owner one usable record.",
    body: "The final handoff keeps the role overview, active work, continuity risks, open questions, source evidence, and employee context together.",
  },
  {
    key: "ask",
    label: "06 · Ask",
    title: "Ask the handoff like a teammate.",
    body: "The successor can ask a question in plain English. Understudy retrieves the relevant evidence, answers only from the handoff, and shows which sources support the answer.",
  },
  {
    key: "verify",
    label: "07 · Verify",
    title: "Finish only when the successor can continue.",
    body: "The successor confirms the transfer, leaves notes, or raises a missing question. A new blocking question reopens the handoff instead of hiding the gap.",
  },
  {
    key: "return",
    label: "08 · Come back later",
    title: "Completed handoffs stay useful.",
    body: "Open any previous handoff from My handoffs, return to its permanent record, and keep asking questions long after the transfer was completed.",
  },
];

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/45 bg-card/80 shadow-[0_22px_70px_rgba(30,45,70,0.09)] backdrop-blur-2xl ${className}`}>
      {children}
    </div>
  );
}

function SmallTag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-subtle">{children}</span>;
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
    <div className="understudy-demo-shell relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-ok/8 blur-3xl" />

      <header className="understudy-topbar relative z-20 border-b border-white/30 bg-background/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium">
            <UnderstudyMark size={32} />
            Understudy
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-accent/15 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent sm:inline-flex">
              Guided demo · fictional data
            </span>
            <Link href="/new" className="rounded-lg bg-foreground px-3.5 py-2 text-xs font-medium text-background">
              Try Understudy
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
        <div className="mb-7 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card/70">
            <motion.div
              className="h-full rounded-full bg-accent"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            />
          </div>
          <span className="text-xs font-medium text-subtle">{index + 1} / {STEPS.length}</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
          <GlassCard className="p-6 lg:sticky lg:top-24">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step.key}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{step.label}</p>
                <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">{step.title}</h1>
                <p className="mt-4 text-sm leading-7 text-muted">{step.body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-7 border-t border-border pt-5">
              <div className="flex flex-wrap gap-1.5">
                {STEPS.map((item, itemIndex) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => go(itemIndex)}
                    aria-label={item.title}
                    className={`h-2 rounded-full transition-all ${itemIndex === index ? "w-7 bg-accent" : itemIndex < index ? "w-2 bg-ok/65" : "w-2 bg-surface-3"}`}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => go(index - 1)}
                  className="h-10 rounded-lg border border-border bg-background/60 px-3.5 text-sm font-medium text-muted disabled:opacity-30"
                >
                  Back
                </button>
                {index < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white"
                  >
                    Next <IconChevronRight />
                  </button>
                ) : (
                  <Link href="/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-white">
                    Start a handoff <IconChevronRight />
                  </Link>
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="relative min-h-[650px] overflow-hidden p-4 sm:p-6 lg:p-8">
            <div className="relative mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium">{transition.person} → {transition.successor}</p>
                <p className="mt-0.5 text-xs text-subtle">{transition.role} handoff</p>
              </div>
              <span className="rounded-full border border-border bg-background/75 px-3 py-1.5 text-xs text-subtle">Demo workspace</span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {step.key === "create" && (
                <motion.div key="create" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="max-w-2xl">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">New handoff</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Who is handing work over?</h2>
                    <p className="mt-2 text-sm text-muted">Set the boundary once. The evidence comes next.</p>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Current owner", transition.person],
                      ["Role", transition.role],
                      ["Next owner", transition.successor],
                      ["Target date", transition.targetDate],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-background/70 p-4">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{label}</p>
                        <p className="mt-2 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-2xl border border-accent/20 bg-accent-soft p-4">
                    <div>
                      <p className="text-sm font-medium">Role change</p>
                      <p className="mt-1 text-xs text-subtle">Understudy will keep this person's evidence separate from every other handoff.</p>
                    </div>
                    <IconChevronRight className="text-accent" />
                  </div>
                </motion.div>
              )}

              {step.key === "collect" && (
                <motion.div key="collect" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="flex flex-wrap gap-2">
                    <SmallTag>Upload files</SmallTag>
                    <SmallTag>Google Drive</SmallTag>
                    <SmallTag>Recover AI context</SmallTag>
                    <SmallTag>Paste text</SmallTag>
                    <SmallTag>Type or dictate</SmallTag>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-2xl font-semibold">{evidence.length + 1}</p>
                      <p className="mt-1 text-xs text-subtle">sources collected</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-2xl font-semibold">{primary.length}</p>
                      <p className="mt-1 text-xs text-subtle">primary sources</p>
                    </div>
                    <div className="rounded-2xl border border-accent/20 bg-accent-soft p-4">
                      <p className="text-2xl font-semibold text-accent">{aiContext.length + 1}</p>
                      <p className="mt-1 text-xs text-subtle">context sources</p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background/60">
                    {evidence.slice(0, 4).map((source, sourceIndex) => (
                      <div key={source.id} className={`flex items-center gap-3 p-4 ${sourceIndex ? "border-t border-border" : ""}`}>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${source.kind === "ai-context" ? "bg-accent-soft text-accent" : "bg-card text-muted"}`}>
                          {source.kind === "ai-context" ? <IconSpark /> : <IconFile />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{source.title}</p>
                          <p className="mt-0.5 text-xs text-subtle">{source.kind === "ai-context" ? "AI-recovered context" : source.provider}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-3 border-t border-border bg-accent-soft/45 p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent"><IconMessage /></span>
                      <div>
                        <p className="text-sm font-medium">How I actually worked in this role</p>
                        <p className="mt-1 text-xs leading-5 text-subtle">Employee-provided context · typed or dictated · clearly marked as self-reported</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step.key === "reconstruct" && (
                <motion.div key="reconstruct" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
                    <div className="flex items-center gap-2"><IconSpark className="text-accent" /><p className="text-sm font-medium">AI reconstruction</p></div>
                    <p className="mt-3 text-sm leading-7 text-muted">{transition.summary}</p>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {transition.projects.slice(0, 4).map((project) => (
                      <div key={project.name} className="rounded-2xl border border-border bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{project.name}</p>
                          <span className="text-[11px] font-medium text-accent">{project.evidence}% evidence</span>
                        </div>
                        <p className="mt-2 text-xs text-subtle">{project.state}</p>
                        <p className="mt-1 text-xs text-muted">{project.ownership}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-subtle">Primary documents, AI-recovered context, and employee narration keep different provenance. Understudy does not silently turn all three into the same kind of truth.</p>
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs text-subtle"><IconMessage className="text-accent" /><span>If one source is missing an important explanation, add context directly to that source and refresh the reconstruction.</span></div>
                </motion.div>
              )}

              {step.key === "gaps" && (
                <motion.div key="gaps" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Questions only a human can answer</p>
                      <p className="mt-1 text-xs text-subtle">Generated after Understudy reads the full evidence set.</p>
                    </div>
                    <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">{criticalGaps.length} critical</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {transition.gaps.slice(0, 3).map((gap, gapIndex) => (
                      <div key={gap.question} className={`rounded-2xl border p-5 ${gapIndex === 0 ? "border-accent/30 bg-accent-soft" : "border-border bg-background/70"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-subtle">{gap.topic}</span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${gap.priority === "Critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{gap.priority}</span>
                        </div>
                        <p className="mt-3 text-sm font-medium leading-6">{gap.question}</p>
                        {gapIndex === 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <SmallTag>Answer</SmallTag>
                            <SmallTag>Dictate</SmallTag>
                            <SmallTag>Ask someone else</SmallTag>
                            <SmallTag>Not relevant</SmallTag>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {step.key === "record" && (
                <motion.div key="record" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">Handoff record</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{transition.role}</h3>
                    </div>
                    <SmallTag>In progress</SmallTag>
                  </div>

                  <div className="mt-5 rounded-2xl border border-border bg-background/70 p-5">
                    <p className="text-sm font-medium">Role overview</p>
                    <p className="mt-2 text-sm leading-7 text-muted">{transition.summary}</p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-sm font-medium">Active work</p>
                      {transition.projects.slice(0, 2).map((project) => <p key={project.name} className="mt-2 text-xs text-muted">{project.name} · {project.state}</p>)}
                    </div>
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-sm font-medium">Continuity risks</p>
                      {transition.risks.slice(0, 2).map((risk) => <p key={risk.title} className="mt-2 text-xs text-muted">{risk.title}</p>)}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/55 p-4">
                    <IconFile className="text-muted" />
                    <div>
                      <p className="text-sm font-medium">The source evidence stays attached.</p>
                      <p className="mt-1 text-xs text-subtle">A successor can inspect where a claim came from instead of trusting a generated summary blindly.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {step.key === "ask" && (
                <motion.div key="ask" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><IconAsk /></span>
                    <div>
                      <p className="text-sm font-medium">Ask this handoff</p>
                      <p className="mt-1 text-xs text-subtle">Understudy retrieves the evidence first, then asks AI to answer from only that context.</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-border bg-background/70 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Question</p>
                    <p className="mt-2 text-sm font-medium">Why did we keep manual review in the onboarding flow?</p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-accent/20 bg-accent-soft/65 p-5">
                    <div className="flex items-center gap-2 text-accent"><IconSpark /><p className="text-sm font-medium">Understudy</p></div>
                    <p className="mt-3 text-sm leading-7 text-foreground">The handoff says manual review was kept as a fallback for cases where automated verification was inconclusive, so the team could keep onboarding moving without treating a failed check as a hard rejection.</p>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-subtle">Evidence used</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-background/70 p-3"><p className="text-xs font-medium">Onboarding fallback notes</p><p className="mt-1 text-[11px] text-subtle">Primary document</p></div>
                      <div className="rounded-xl border border-border bg-background/70 p-3"><p className="text-xs font-medium">Decision context</p><p className="mt-1 text-[11px] text-subtle">Employee-provided clarification</p></div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step.key === "verify" && (
                <motion.div key="verify" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div className="text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-6 w-6" /></span>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Can the successor continue the work?</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Verification is a real user action, not an AI score.</p>
                  </div>

                  <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-2xl border border-border bg-background/70">
                    {["I understand the role scope", "I understand the active work", "I know what I own", "I reviewed the risks", "I reviewed the open questions"].map((label, itemIndex) => (
                      <div key={label} className={`flex items-center gap-3 p-4 ${itemIndex ? "border-t border-border" : ""}`}>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-3.5 w-3.5" /></span>
                        <span className="text-sm text-muted">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
                      <p className="text-sm font-medium">Something is still unclear?</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">Raise a follow-up. Understudy reopens the handoff so the gap cannot be hidden by completion.</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <p className="text-sm font-medium">Successor notes</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">Notes stay attached to the permanent record after acceptance.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {step.key === "return" && (
                <motion.div key="return" initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">My handoffs</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">The record still works after the handoff is over.</h3>
                    <p className="mt-2 text-xs leading-5 text-subtle">With account sync enabled, the private handoff library is available again when you sign in on another device.</p>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background/70">
                    <div className="flex items-center gap-4 p-4">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-ok/10 text-ok"><IconCheck /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{transition.person}</p>
                        <p className="mt-1 text-xs text-subtle">{transition.role} → {transition.successor}</p>
                      </div>
                      <span className="rounded-full bg-ok/10 px-2.5 py-1 text-[11px] font-medium text-ok">Complete</span>
                      <IconChevronRight className="text-faint" />
                    </div>
                    <div className="flex items-center gap-4 border-t border-border p-4 opacity-70">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-card text-muted"><IconTransition /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Daniel Mensah</p>
                        <p className="mt-1 text-xs text-subtle">Finance Operations → Aisha Bello</p>
                      </div>
                      <SmallTag>In progress</SmallTag>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-accent/20 bg-accent-soft/60 p-5">
                    <div className="flex items-center gap-2 text-accent"><IconAsk /><p className="text-sm font-medium">Ask a completed handoff</p></div>
                    <p className="mt-3 text-sm font-medium">What should I check before changing the approval thresholds?</p>
                    <p className="mt-3 text-sm leading-7 text-muted">Understudy answers from the saved evidence, reviewed context, and final handoff record, with citations. You do not need the former owner to still be around.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </div>

        <div className="mt-7 text-center">
          <p className="text-xs text-subtle">This demo uses fictional data and mirrors the current handoff flow. It does not create or change a real handoff.</p>
        </div>
      </main>
    </div>
  );
}
