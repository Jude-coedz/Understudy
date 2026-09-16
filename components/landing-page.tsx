"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { IconChevronRight, IconFile, IconSpark, IconCheck } from "./icons";

const steps = [
  {
    number: "01",
    title: "Bring the work.",
    body: "Add the documents, notes, Drive files, and AI context that already explain the role.",
    icon: IconFile,
  },
  {
    number: "02",
    title: "Understudy connects it.",
    body: "It reconstructs responsibilities, active work, decisions, risks, and what the evidence still cannot explain.",
    icon: IconSpark,
  },
  {
    number: "03",
    title: "Hand it over with confidence.",
    body: "Answer only the gaps that matter. Then the next owner verifies they can actually continue the work.",
    icon: IconCheck,
  },
];

export function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>
            Understudy
          </Link>
          <Link href="/handoffs" className="text-sm font-medium text-muted transition-colors hover:text-foreground">
            My handoffs
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto flex min-h-[72vh] max-w-6xl items-center px-5 py-20 lg:px-8 lg:py-28">
          <div className="max-w-4xl">
            <motion.p
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="text-sm font-medium text-accent"
            >
              Work moves. Knowledge shouldn&apos;t disappear.
            </motion.p>
            <motion.h1
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.05, duration: 0.45 }}
              className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-7xl"
            >
              Turn scattered work into a handoff someone can actually continue.
            </motion.h1>
            <motion.p
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.1, duration: 0.45 }}
              className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl"
            >
              Understudy reads the work that already exists, finds what would otherwise be lost, and helps the next owner verify the transfer.
            </motion.p>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.15, duration: 0.4 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href="/new" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5">
                Start a handoff <IconChevronRight />
              </Link>
              <Link href="/handoffs" className="inline-flex h-12 items-center rounded-xl border border-border bg-card px-5 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground">
                View my handoffs
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-18 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-subtle">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Three steps. No handoff theatre.</h2>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    key={step.number}
                    initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ delay: reducedMotion ? 0 : index * 0.06, duration: 0.35 }}
                    className="rounded-3xl border border-border bg-card p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-faint">{step.number}</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background text-muted">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <h3 className="mt-10 text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
                  </motion.article>
                );
              })}
            </div>

            <div className="mt-14 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-medium">The goal is simple.</p>
                <p className="mt-1 text-sm text-muted">When ownership changes, the work should still move.</p>
              </div>
              <Link href="/new" className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-foreground px-4 text-sm font-medium text-background sm:self-auto">
                Create a handoff <IconChevronRight />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
