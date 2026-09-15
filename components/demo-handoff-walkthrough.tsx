"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconSpark,
} from "./icons";

type DemoStep = "collect" | "understand" | "gaps" | "handoff";

const STEPS: Array<{ key: DemoStep; plain: string; product: string }> = [
  { key: "collect", plain: "Collect", product: "Evidence" },
  { key: "understand", plain: "Understand", product: "Reconstruction" },
  { key: "gaps", plain: "Fill the gaps", product: "Interview" },
  { key: "handoff", plain: "Hand over", product: "Verification" },
];

function confidenceLabel(kind: string) {
  if (kind === "document" || kind === "github") return "Primary evidence";
  if (kind === "ai-context") return "AI-recovered";
  return "Self-reported";
}

function StepProgress({ step }: { step: DemoStep }) {
  const activeIndex = STEPS.findIndex((item) => item.key === step);
  return (
    <div className="grid gap-2 sm:grid-cols-4" aria-label="Demo handoff progress">
      {STEPS.map((item, index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;
        return (
          <div
            key={item.key}
            className={`rounded-xl border px-3 py-3 ${active ? "border-border-strong bg-card" : "border-border bg-background"}`}
          >
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${complete ? "border-accent bg-accent text-white" : active ? "border-border-strong bg-card-hover text-foreground" : "border-border text-faint"}`}>
                {complete ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div>
                <p className={`text-xs font-medium ${active || complete ? "text-foreground" : "text-subtle"}`}>{item.plain}</p>
                <p className="text-[11px] text-faint">{item.product}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
    >
      {children} <IconChevronRight />
    </button>
  );
}

export function DemoHandoffWalkthrough({ transition }: { transition: Transition }) {
  const reducedMotion = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState<DemoStep>("collect");

  const evidenceSources = transition.sources.filter((source) => source.kind !== "interview");
  const primaryCount = evidenceSources.filter((source) => source.kind === "document" || source.kind === "github").length;
  const aiCount = evidenceSources.filter((source) => source.kind === "ai-context").length;
  const interviewCount = transition.sources.filter((source) => source.kind === "interview").length;
  const assignedProjects = transition.projects.filter((project) => !/unassigned|unknown|unclear/i.test(project.ownership));
  const criticalGaps = transition.gaps.filter((gap) => gap.priority === "Critical");

  const unresolvedReasons = useMemo(() => {
    const reasons: string[] = [];
    const unassigned = transition.projects.filter((project) => /unassigned|unknown|unclear/i.test(project.ownership));
    if (unassigned.length) reasons.push(`${unassigned.length} active work item${unassigned.length === 1 ? " has" : "s have"} no next owner`);
    if (criticalGaps.length) reasons.push(`${criticalGaps.length} critical handoff question${criticalGaps.length === 1 ? " is" : "s are"} still open`);
    reasons.push("Successor verification has not started");
    return reasons;
  }, [criticalGaps.length, transition.projects]);

  function go(next: DemoStep) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  if (!started) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12 lg:px-8 lg:py-16">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white">U</span>
              Understudy
            </Link>
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-subtle">Demo data</span>
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <section>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Example handoff</p>
              <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.055em] sm:text-[54px]">
                See how scattered work becomes a handoff someone can continue.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
                {transition.person} is moving out of a {transition.role} role. {transition.successor} is taking over. Understudy starts with the work that already exists, finds what the evidence cannot explain, then verifies what still needs to transfer.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => setStarted(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
                  Start with {transition.person.split(" ")[0]}&apos;s evidence <IconChevronRight />
                </button>
                <Link href={`/transitions/${transition.id}?mode=workspace`} className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted hover:bg-card-hover">
                  Open full demo workspace
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-faint">The full workspace is the advanced view. This walkthrough explains the workflow first.</p>
            </section>

            <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">The scenario</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-xs font-semibold">{transition.initials}</span>
                <div>
                  <p className="text-sm font-medium">{transition.person}</p>
                  <p className="text-xs text-subtle">{transition.role} · {transition.department}</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm text-muted">
                <div className="flex justify-between gap-4"><span>Evidence available</span><span className="font-medium text-foreground">{transition.sources.length} sources</span></div>
                <div className="flex justify-between gap-4"><span>Work areas reconstructed</span><span className="font-medium text-foreground">{transition.projects.length}</span></div>
                <div className="flex justify-between gap-4"><span>Open handoff questions</span><span className="font-medium text-foreground">{transition.gaps.length}</span></div>
                <div className="flex justify-between gap-4"><span>Next owner</span><span className="font-medium text-foreground">{transition.successor}</span></div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-4 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white">U</span>
              Understudy
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-subtle sm:inline">Demo data</span>
              <button type="button" onClick={() => setStarted(false)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover">Restart demo</button>
            </div>
          </div>
          <div className="mt-4"><StepProgress step={step} /></div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={reducedMotion ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          >
            {step === "collect" && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">1 · Collect</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Start with work that already exists.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  Understudy should not begin by asking {transition.person.split(" ")[0]} to remember everything. It first reads the artifacts the team already produced, then keeps each source traceable.
                </p>

                <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card">
                  {transition.sources.map((source, index) => (
                    <div key={source.id} className={`flex items-start gap-3 px-4 py-4 ${index ? "border-t border-border" : ""}`}>
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="h-4 w-4 text-muted" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{source.title}</p>
                          <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-subtle">{confidenceLabel(source.kind)}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-subtle">{source.provider} · {source.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted">
                  <span className="font-medium text-foreground">What matters here:</span> {primaryCount} sources are primary evidence{aiCount ? `, ${aiCount} is AI-recovered` : ""}{interviewCount ? `, and ${interviewCount} is self-reported interview context` : ""}. Understudy keeps those confidence levels separate.
                </div>

                <div className="mt-7"><NextButton onClick={() => go("understand")}>See what Understudy reconstructed</NextButton></div>
              </div>
            )}

            {step === "understand" && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">2 · Understand</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Turn files into a map of the work.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  Understudy combines the evidence into observed work areas. This is a reconstruction of what the supplied evidence supports, not a claim that it knows every project {transition.person.split(" ")[0]} ever touched.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {transition.projects.map((project) => (
                    <div key={project.name} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="mt-1 text-xs text-subtle">{project.state}</p>
                        </div>
                        <span className={`rounded-md px-2 py-1 text-[11px] ${/unassigned/i.test(project.ownership) ? "bg-warning/10 text-warning" : "bg-ok/10 text-ok"}`}>
                          {/unassigned/i.test(project.ownership) ? "Owner missing" : "Owner identified"}
                        </span>
                      </div>
                      <p className="mt-4 text-xs leading-5 text-muted">{project.ownership}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2"><IconAlert className="text-warning" /><p className="text-sm font-medium">Understudy also found {transition.risks.length} continuity risks</p></div>
                  <p className="mt-2 text-xs leading-5 text-subtle">Risks are not proof of missing work. They point to places where the current evidence suggests the successor could get stuck.</p>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => go("collect")} className="h-11 rounded-lg border border-border bg-card px-4 text-sm text-muted">Back</button>
                  <NextButton onClick={() => go("gaps")}>Review what the evidence cannot explain</NextButton>
                </div>
              </div>
            )}

            {step === "gaps" && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">3 · Fill the gaps</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Ask only what the artifacts cannot answer.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  These questions come from unresolved evidence gaps. The employee can answer, delegate, say they do not know, or mark something irrelevant instead of being forced through a generic exit interview.
                </p>

                <div className="mt-7 space-y-3">
                  {transition.gaps.map((gap, index) => (
                    <div key={gap.question} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-subtle">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] ${gap.priority === "Critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{gap.priority}</span>
                            <span className="text-xs text-subtle">{gap.topic}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-6">{gap.question}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-xl border border-accent/20 bg-accent-soft p-4">
                  <div className="flex items-start gap-3"><IconSpark className="mt-0.5 text-accent" /><p className="text-sm leading-6 text-muted"><span className="font-medium text-foreground">The goal is not to get to zero questions at any cost.</span> Critical gaps must be resolved or explicitly handed to someone. Lower-priority gaps can remain visible in the handoff.</p></div>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => go("understand")} className="h-11 rounded-lg border border-border bg-card px-4 text-sm text-muted">Back</button>
                  <NextButton onClick={() => go("handoff")}>Check whether the handoff is ready</NextButton>
                </div>
              </div>
            )}

            {step === "handoff" && (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">4 · Hand over</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Is {transition.successor} ready to continue the work?</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  Understudy only measures a handoff check when the denominator is explicit. It does not turn an unknown part of the role into a made-up completeness percentage.
                </p>

                <div className="mt-7 rounded-2xl border border-border bg-card p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">Current demo status</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Not ready yet</h2>
                    </div>
                    <span className="w-fit rounded-full border border-warning/25 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">Action required</span>
                  </div>

                  <div className="mt-6 divide-y divide-border border-y border-border">
                    <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <div><p className="text-sm font-medium">Active work has a next owner</p><p className="mt-1 text-xs leading-5 text-subtle">Count only work areas with an explicit successor or durable team owner.</p></div>
                      <p className="text-sm font-semibold sm:text-right">{assignedProjects.length} of {transition.projects.length}</p>
                    </div>
                    <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <div><p className="text-sm font-medium">Critical gaps resolved</p><p className="mt-1 text-xs leading-5 text-subtle">Critical questions remain open until answered, delegated, or explicitly classified.</p></div>
                      <p className="text-sm font-semibold sm:text-right">0 of {criticalGaps.length}</p>
                    </div>
                    <div className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <div><p className="text-sm font-medium">Successor verification checks</p><p className="mt-1 text-xs leading-5 text-subtle">Role scope, active work, ownership, risks, and open questions must be reviewed by the successor.</p></div>
                      <p className="text-sm font-semibold sm:text-right">0 of 5</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-warning/20 bg-warning/5 p-4">
                    <p className="text-sm font-medium">What is blocking completion</p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted">
                      {unresolvedReasons.map((reason) => <li key={reason}>• {reason}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Why there is no “78% complete” here</p>
                  <p className="mt-2 text-xs leading-5 text-subtle">
                    Evidence coverage and transfer readiness are different. Understudy can say what the supplied evidence supports, but it cannot prove that no project or responsibility was forgotten. Transfer readiness should come from explicit items that can be counted and reviewed.
                  </p>
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={() => go("gaps")} className="h-11 rounded-lg border border-border bg-card px-4 text-sm text-muted">Back</button>
                  <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">Start your own handoff <IconChevronRight /></Link>
                  <Link href={`/transitions/${transition.id}?mode=workspace`} className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted hover:bg-card-hover">Open advanced demo workspace</Link>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}
