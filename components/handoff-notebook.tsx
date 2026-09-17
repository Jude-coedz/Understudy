"use client";

import { motion, useReducedMotion } from "motion/react";

function inlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function HandoffNotebook({ markdown }: { markdown: string }) {
  const reducedMotion = useReducedMotion();
  const lines = markdown.split("\n");

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8, rotateX: 1.5 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
      className="relative overflow-hidden rounded-[22px] border border-border-strong bg-[#fffef9] shadow-[0_18px_60px_rgba(20,24,28,0.08)]"
    >
      <div className="absolute bottom-0 left-12 top-0 w-px bg-danger/15" aria-hidden="true" />
      <div
        className="min-h-[430px] px-7 py-8 pl-16 sm:px-10 sm:pl-20"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,105,115,0.09) 32px)",
          backgroundSize: "100% 32px",
        }}
      >
        {lines.map((line, index) => {
          const key = `${index}-${line}`;
          if (!line.trim()) return <div key={key} className="h-4" />;
          if (line.startsWith("# ")) {
            return <h2 key={key} className="mb-5 text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-[28px]">{line.slice(2)}</h2>;
          }
          if (line.startsWith("## ")) {
            return <h3 key={key} className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-subtle">{line.slice(3)}</h3>;
          }
          if (line.startsWith("- ")) {
            return <div key={key} className="flex gap-3 py-1.5 text-sm leading-7 text-muted"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /><p>{inlineText(line.slice(2))}</p></div>;
          }
          return <p key={key} className="py-1 text-sm leading-7 text-muted">{inlineText(line)}</p>;
        })}
      </div>
    </motion.div>
  );
}
