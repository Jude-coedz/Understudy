"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconAsk, IconCheck, IconChevronRight, IconFile, IconMessage, IconSpark } from "./icons";
import { UnderstudyMark } from "./understudy-mark";

const steps = [
  {
    number: "01",
    title: "Bring the work",
    body: "Add files, Drive documents, AI context, and the employee's own explanation.",
    icon: IconFile,
  },
  {
    number: "02",
    title: "Connect the role",
    body: "Understudy reconstructs responsibilities, active work, decisions, ownership, and risks.",
    icon: IconSpark,
  },
  {
    number: "03",
    title: "Fill only the gaps",
    body: "It asks for the rationale, exceptions, and unwritten context the evidence still cannot explain.",
    icon: IconMessage,
  },
  {
    number: "04",
    title: "Verify the transfer",
    body: "The next owner reviews, asks questions, and confirms they can actually continue the work.",
    icon: IconCheck,
  },
];

export function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="understudy-marketing-shell min-h-screen text-foreground">
      <header className="understudy-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]">
            <UnderstudyMark size={32} />
            Understudy
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/handoffs" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-muted hover:text-foreground sm:inline-flex">My handoffs</Link>
            <Link href="/demo" className="hidden rounded-xl border border-border bg-card/75 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur-xl hover:text-foreground sm:inline-flex">Guided demo</Link>
            <Link href="/new" data-ui-action="primary" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm">Create a handoff</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="understudy-hero relative mx-auto grid min-h-[78vh] max-w-[1440px] items-center gap-12 overflow-hidden px-5 py-16 lg:grid-cols-[minmax(0,.74fr)_minmax(640px,1.26fr)] lg:px-8 lg:py-24">
          <div className="understudy-ambient -left-32 -top-16 h-[28rem] w-[28rem] opacity-40" aria-hidden />
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-card/65 px-3 py-1.5 text-xs font-medium text-accent shadow-sm backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_0_4px_rgba(44,118,136,.09)]" />
              Evidence-first handoffs
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.065em] sm:text-6xl lg:text-[68px] lg:leading-[0.98]">
              When someone leaves, their <span className="understudy-gradient-text">context should not.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Understudy reconstructs the work from what already exists, finds the context only the employee knows, and turns it into a handoff the next person can actually use.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/new" data-ui-action="primary" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm">
                Create a handoff
                <IconChevronRight />
              </Link>
              <Link href="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card/80 px-5 text-sm font-semibold text-muted backdrop-blur-xl">
                <IconSpark className="h-4 w-4" />
                Guided demo
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-subtle">
              <span>Files</span><span className="text-faint">/</span>
              <span>Google Drive</span><span className="text-faint">/</span>
              <span>AI context</span><span className="text-faint">/</span>
              <span>Voice + typed context</span><span className="text-faint">→</span>
              <span className="font-medium text-foreground">one verified handoff</span>
            </div>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <div className="understudy-hero-glow absolute -inset-10 rounded-[48px]" aria-hidden />
            <div className="understudy-product-frame relative overflow-hidden rounded-[26px] border border-white/70 bg-card/88 shadow-[0_34px_100px_rgba(20,42,50,.16)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
                <div className="flex items-center gap-3">
                  <UnderstudyMark size={30} subtle />
                  <div>
                    <p className="text-sm font-semibold">Maya Okafor → Priya Nair</p>
                    <p className="text-xs text-subtle">Product Manager handoff</p>
                  </div>
                </div>
                <span className="rounded-full border border-ok/15 bg-ok/8 px-2.5 py-1 text-[11px] font-medium text-ok">Permanent handoff</span>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Completed handoff · Product Manager</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">Ask the context after Maya has left.</h2>
                    <p className="mt-1 text-xs leading-5 text-subtle">The permanent record keeps the evidence, human context, decisions, and successor notes together.</p>
                  </div>
                  <span className="rounded-full border border-ok/15 bg-ok/8 px-2.5 py-1 text-[11px] font-semibold text-ok">Verified by Priya</span>
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-background/76 p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-accent">
                    <IconAsk className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Ask this handoff</p>
                  </div>
                  <p className="mt-3 text-base font-semibold">Why did we keep manual review in onboarding?</p>
                </div>

                <div className="mt-3 rounded-2xl border border-accent/18 bg-accent-soft/58 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-accent"><IconSpark className="h-4 w-4" /><p className="text-sm font-semibold">Understudy</p></div>
                  <p className="mt-3 text-sm leading-7 text-foreground">Manual review stayed as a fallback for cases where automated verification was inconclusive. It kept onboarding moving without treating a failed check as a hard rejection.</p>
                  <p className="mt-3 text-xs leading-5 text-subtle">This answer is grounded in the saved handoff, not generated from general company knowledge.</p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/72 p-3.5">
                    <p className="text-xs font-semibold">Onboarding fallback notes</p>
                    <p className="mt-1 text-[11px] text-subtle">Primary document · cited</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/72 p-3.5">
                    <p className="text-xs font-semibold">Decision context</p>
                    <p className="mt-1 text-[11px] text-subtle">Employee-provided context · cited</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/75 pt-4">
                  <p className="text-xs text-subtle">The former owner does not need to be around for the answer to still exist.</p>
                  <span className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold text-muted">2 sources used</span>
                </div>
              </div>
            </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Approval workflows", "Active · ownership clear", "84%"],
                      ["Merchant onboarding", "Decision context recovered", "76%"],
                      ["Refund automation", "1 unanswered dependency", "62%"],
                      ["Customer escalations", "Recurring responsibility", "71%"],
                    ].map(([title, meta, score], index) => (
                      <motion.div
                        key={title}
                        animate={reducedMotion ? undefined : { y: [0, index % 2 ? 2 : -2, 0] }}
                        transition={{ duration: 5 + index, repeat: Infinity, ease: "easeInOut" }}
                        className="rounded-2xl border border-border/80 bg-background/72 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">{title}</p>
                          <span className="text-[11px] font-semibold text-accent">{score}</span>
                        </div>
                        <p className="mt-2 text-xs text-subtle">{meta}</p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-accent/18 bg-accent-soft/55 p-4">
                    <div className="flex items-center gap-2 text-accent">
                      <IconAsk className="h-4 w-4" />
                      <p className="text-xs font-semibold uppercase tracking-[0.08em]">Ask Understudy</p>
                    </div>
                    <p className="mt-2 text-sm font-medium">Why did we keep manual review in onboarding?</p>
                    <p className="mt-2 text-xs leading-5 text-muted">Because automated checks were still inconclusive in some cases, and the team needed a safe fallback that kept onboarding moving.</p>
                    <div className="mt-3 flex gap-2">
                      <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-subtle">PRD</span>
                      <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-subtle">Employee context</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -8, 0], rotate: [0, -0.7, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-white/70 bg-card/92 px-4 py-3 shadow-xl backdrop-blur-xl sm:block"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-4 w-4" /></span>
                <div><p className="text-xs font-semibold">Successor verified</p><p className="text-[10px] text-subtle">Handoff can close</p></div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section className="border-y border-border/70 bg-card/30">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-accent">How it works</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Less documentation theatre. More usable context.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-muted">The product reads first, asks second, and keeps the original evidence attached all the way through.</p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    key={step.number}
                    initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ delay: reducedMotion ? 0 : index * 0.055, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                    className="understudy-feature-card group rounded-[22px] border border-border/85 bg-card/78 p-5 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-faint">{step.number}</span>
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/80 text-muted transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"><Icon className="h-4 w-4" /></span>
                    </div>
                    <h3 className="mt-9 text-lg font-semibold tracking-[-0.025em]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
                  </motion.article>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col gap-5 rounded-[26px] border border-border/80 bg-foreground px-6 py-6 text-background shadow-[0_24px_70px_rgba(20,33,38,.16)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <p className="text-lg font-semibold">The old owner can leave. The context does not.</p>
                <p className="mt-1 text-sm text-background/65">Try the fictional walkthrough, then create your own handoff.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/demo" className="rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white">Guided demo</Link>
                <Link href="/new" data-ui-action="primary" style={{ color: "#ffffff" }} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold shadow-sm">Create a handoff <IconChevronRight /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
