import cases from "@/data/eval.json";
import { extractFallback } from "./fallback";
import type { EvalCase, ExtractionDraft } from "./types";

export type EvalResult = {
  id: string;
  pass: boolean;
  draft: ExtractionDraft;
  missed: string[];
};

export function scoreDraft(
  draft: ExtractionDraft,
  expected: EvalCase,
): { pass: boolean; missed: string[] } {
  const missed: string[] = [];
  if (draft.topic !== expected.expectedTopic) {
    missed.push(`topic:${draft.topic}≠${expected.expectedTopic}`);
  }
  for (const person of expected.expectedPeople) {
    const ok = draft.peopleMentioned.some(
      (x) =>
        x.toLowerCase().includes(person.toLowerCase()) ||
        person.toLowerCase().includes(x.toLowerCase()),
    );
    if (!ok) missed.push(`person:${person}`);
  }
  const why = draft.reasoning.toLowerCase();
  for (const phrase of expected.whyPhrases) {
    if (!why.includes(phrase.toLowerCase())) missed.push(`why:${phrase}`);
  }
  return { pass: missed.length === 0, missed };
}

export function runExtractionEval(): {
  passed: number;
  total: number;
  results: EvalResult[];
} {
  const list = cases as EvalCase[];
  const results: EvalResult[] = list.map((c) => {
    const draft = extractFallback(c.answer);
    const { pass, missed } = scoreDraft(draft, c);
    return { id: c.id, pass, draft, missed };
  });
  return {
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    results,
  };
}
