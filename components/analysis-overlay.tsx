"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconSpark } from "./icons";

export function AnalysisOverlay({
  open,
  title,
  detail,
  phases,
  activePhase,
}: {
  open: boolean;
  title: string;
  detail?: string;
  phases: string[];
  activePhase: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-background/55 p-5 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          aria-busy="true"
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 30 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-border-strong bg-card/92 shadow-2xl backdrop-blur-2xl"
          >
            <div className="relative overflow-hidden border-b border-border px-5 py-5">
              <div className="understudy-ambient -right-20 -top-24 h-56 w-56 opacity-35" aria-hidden />
              <div className="relative flex items-start gap-3">
                <motion.span
                  animate={reducedMotion ? undefined : { rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-accent/20 bg-accent-soft text-accent"
                >
                  <IconSpark className="h-5 w-5" />
                </motion.span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  {detail && <p className="mt-1 text-xs leading-5 text-subtle">{detail}</p>}
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="space-y-2.5">
                {phases.map((phase, index) => {
                  const complete = index < activePhase;
                  const active = index === activePhase;
                  return (
                    <div key={phase} className="flex items-center gap-3">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold ${
                          complete
                            ? "border-ok/25 bg-ok/10 text-ok"
                            : active
                              ? "border-accent/25 bg-accent-soft text-accent"
                              : "border-border bg-background text-faint"
                        }`}
                      >
                        {complete ? "✓" : index + 1}
                      </span>
                      <span className={`text-sm ${active || complete ? "text-muted" : "text-faint"}`}>{phase}</span>
                      {active && (
                        <motion.span
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-accent"
                          animate={reducedMotion ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.8, 1.25, 0.8] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 h-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  animate={{ width: `${Math.max(8, ((Math.max(activePhase, 0) + 1) / Math.max(phases.length, 1)) * 100)}%` }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 24 }}
                />
              </div>
              <p className="mt-3 text-[11px] leading-5 text-faint">Understudy keeps your evidence in place while this runs. You do not need to re-upload anything.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
