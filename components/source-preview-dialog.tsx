"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SourceItem } from "@/data/v2-demo";
import { IconFile } from "./icons";

type Props = {
  source: SourceItem | null;
  body: string;
  onClose: () => void;
  title?: string;
};

export function SourcePreviewDialog({ source, body, onClose, title = "Source context" }: Props) {
  const reducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {source && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) => event.stopPropagation()}
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 34 }}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="h-4 w-4 text-muted" /></span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">{title}</p>
                  <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">{source.title}</h2>
                  <p className="mt-1 text-xs text-subtle">{source.provider} · {source.confidence}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-background">Close</button>
            </div>
            <div className="max-h-[68vh] overflow-auto px-5 py-5 sm:px-6">
              <p className="mb-4 text-xs leading-5 text-subtle">This is the stored evidence text Understudy used. It is shown so you can trace a finding or interview question back to the material that informed it.</p>
              <div className="notebook-sheet relative overflow-hidden rounded-2xl border border-border-strong">
                <div className="notebook-sheet-margin" aria-hidden />
                <div className="notebook-sheet-content">
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-8 text-muted">{body || "Stored source text is unavailable."}</pre>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
