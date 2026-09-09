"use client";

import { useMemo } from "react";
import { Explain } from "./explain";
import { runExtractionEval } from "@/lib/eval";

export function EvalBadge() {
  const result = useMemo(() => runExtractionEval(), []);
  const ok = result.passed === result.total;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] ${
        ok
          ? "border-ok/30 text-ok"
          : "border-danger/30 text-danger"
      }`}
      title={result.results
        .filter((r) => !r.pass)
        .map((r) => `${r.id}: ${r.missed.join(", ")}`)
        .join("\n")}
    >
      <Explain term="Eval">
        Eight Lagos answers scored for topic, named people, and whether the why
        survived. If this drops below 8/8, the extractor is paraphrasing.
      </Explain>
      {result.passed}/{result.total}
    </span>
  );
}
