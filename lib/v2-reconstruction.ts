import type { EvidenceKind, SourceItem, Transition } from "@/data/v2-demo";

export type ReconstructionInput = {
  transition: Pick<
    Transition,
    "person" | "role" | "department" | "successor" | "targetDate"
  >;
  source: {
    title: string;
    kind: EvidenceKind;
    provider: string;
    text: string;
  };
};

export type ReconstructionResult = {
  summary: string;
  source: SourceItem;
  projects: Transition["projects"];
  risks: Transition["risks"];
  gaps: Transition["gaps"];
  metrics: Transition["metrics"];
  readiness: number;
};

type ModelReconstruction = {
  summary?: string;
  extracted?: string[];
  projects?: Array<{
    name?: string;
    state?: string;
    ownership?: string;
    evidence?: number;
  }>;
  risks?: Array<{
    title?: string;
    detail?: string;
    severity?: string;
  }>;
  gaps?: Array<{
    question?: string;
    topic?: string;
    priority?: string;
  }>;
  coverage?: {
    responsibilities?: number;
    activeWork?: number;
    decisions?: number;
    tacitKnowledge?: number;
    ownership?: number;
  };
};

const clamp = (value: number, fallback = 50) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? Math.round(value) : fallback));

function compact(value: string | undefined, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

function sentenceLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, "").trim())
    .filter((line) => line.length >= 18)
    .slice(0, 12);
}

function fallbackExtracted(text: string) {
  const lines = sentenceLines(text);
  const lower = text.toLowerCase();
  const decisions = (lower.match(/\b(decid|chose|defer|reject|trade.?off|because)\w*/g) ?? []).length;
  const risks = (lower.match(/\b(risk|block|issue|problem|fragile|depend|manual|warning)\w*/g) ?? []).length;
  const projects = (lower.match(/\b(project|initiative|launch|rollout|migration|feature|service|workflow)\w*/g) ?? []).length;

  const extracted = [
    `${Math.max(1, Math.min(8, projects || 1))} work areas detected`,
    `${Math.min(8, decisions)} decision signals`,
    `${Math.min(8, risks)} risk/dependency signals`,
  ];

  if (lines.length > 5) extracted.push(`${lines.length} context statements`);
  return extracted;
}

export function fallbackReconstruction(input: ReconstructionInput): ModelReconstruction {
  const lines = sentenceLines(input.source.text);
  const title = input.source.title || "Imported work context";
  const likelyProject =
    lines.find((line) => /project|initiative|workflow|service|launch|migration|product/i.test(line)) ??
    title;

  const whyLine = lines.find((line) => /because|reason|trade.?off|decid|defer|reject/i.test(line));
  const riskLine = lines.find((line) => /risk|issue|block|depend|manual|fragile|warning/i.test(line));

  return {
    summary: `${input.transition.person}'s imported evidence adds context about ${title}. Review the reconstructed work and answer the open questions before treating it as verified handoff knowledge.`,
    extracted: fallbackExtracted(input.source.text),
    projects: [
      {
        name: compact(likelyProject.split(/[.:]/)[0], title).slice(0, 72),
        state: "Needs review",
        ownership: `${input.transition.person} → ${input.transition.successor}`,
        evidence: lines.length >= 5 ? 68 : 48,
      },
    ],
    risks: [
      {
        title: whyLine ? "Decision rationale needs verification" : "Evidence lacks explicit decision rationale",
        detail: compact(
          riskLine,
          "This source adds useful context, but Understudy could not verify all dependencies, decision rationale, and current ownership from the evidence alone.",
        ),
        severity: "Medium",
      },
    ],
    gaps: [
      {
        question: whyLine
          ? "Is this still the current rationale, and what would cause the decision to change?"
          : "What important decision or tradeoff is not obvious from this source?",
        topic: title,
        priority: "Important",
      },
    ],
    coverage: {
      responsibilities: lines.length >= 4 ? 66 : 44,
      activeWork: lines.length >= 5 ? 70 : 50,
      decisions: whyLine ? 62 : 34,
      tacitKnowledge: input.source.kind === "ai-context" ? 68 : 42,
      ownership: 58,
    },
  };
}

export function normalizeReconstruction(
  input: ReconstructionInput,
  raw: ModelReconstruction | null,
): ReconstructionResult {
  const fallback = fallbackReconstruction(input);
  const model = raw ?? fallback;
  const coverage = model.coverage ?? fallback.coverage!;

  const projects = (model.projects ?? fallback.projects ?? [])
    .filter((project) => project?.name)
    .slice(0, 8)
    .map((project) => ({
      name: compact(project.name, input.source.title).slice(0, 90),
      state: compact(project.state, "Needs review").slice(0, 40),
      ownership: compact(
        project.ownership,
        `${input.transition.person} → ${input.transition.successor}`,
      ).slice(0, 80),
      evidence: clamp(project.evidence ?? 55, 55),
    }));

  const risks = (model.risks ?? fallback.risks ?? [])
    .filter((risk) => risk?.title)
    .slice(0, 6)
    .map((risk) => ({
      title: compact(risk.title, "Continuity risk").slice(0, 120),
      detail: compact(risk.detail, "This risk needs employee verification.").slice(0, 320),
      severity: risk.severity === "High" ? ("High" as const) : ("Medium" as const),
    }));

  const gaps = (model.gaps ?? fallback.gaps ?? [])
    .filter((gap) => gap?.question)
    .slice(0, 8)
    .map((gap) => ({
      question: compact(gap.question, "What context is still missing?").slice(0, 220),
      topic: compact(gap.topic, input.source.title).slice(0, 90),
      priority: gap.priority === "Critical" ? ("Critical" as const) : ("Important" as const),
    }));

  const metricValues = {
    responsibilities: clamp(coverage.responsibilities ?? 50),
    activeWork: clamp(coverage.activeWork ?? 50),
    decisions: clamp(coverage.decisions ?? 45),
    tacitKnowledge: clamp(coverage.tacitKnowledge ?? 45),
    ownership: clamp(coverage.ownership ?? 50),
  };

  // Successor review is a real product event and must not be invented by the model.
  // Until a successor-review workflow exists, that 10% remains unearned.
  const readiness = clamp(
    metricValues.responsibilities * 0.2 +
      metricValues.activeWork * 0.2 +
      metricValues.decisions * 0.2 +
      metricValues.tacitKnowledge * 0.15 +
      metricValues.ownership * 0.15,
  );

  const confidence: SourceItem["confidence"] =
    input.source.kind === "ai-context"
      ? "AI-recovered"
      : input.source.kind === "interview"
        ? "Self-reported"
        : "Primary";

  return {
    summary: compact(model.summary, fallback.summary ?? "Evidence reconstructed."),
    source: {
      id: `source-${Date.now()}`,
      title: input.source.title,
      kind: input.source.kind,
      provider: input.source.provider,
      meta: `Imported ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })} · awaiting review`,
      extracted: (model.extracted ?? fallback.extracted ?? ["Evidence imported"]).slice(0, 6),
      confidence,
    },
    projects,
    risks,
    gaps,
    readiness,
    metrics: [
      { label: "Responsibilities", value: metricValues.responsibilities, note: "Evidence-derived" },
      { label: "Active work", value: metricValues.activeWork, note: `${projects.length} work areas` },
      { label: "Decisions", value: metricValues.decisions, note: "Rationale coverage" },
      { label: "Tacit knowledge", value: metricValues.tacitKnowledge, note: input.source.kind === "ai-context" ? "AI context imported" : "Needs interview" },
      { label: "Ownership", value: metricValues.ownership, note: "Assignment confidence" },
      { label: "Successor review", value: 0, note: "Not reviewed" },
    ],
  };
}

export const RECONSTRUCTION_SYSTEM = `You are Understudy, an evidence-first work handoff analyst.

You will receive one evidence source plus transition context. Reconstruct only what the source supports. Do not invent projects, people, dates, metrics, ownership, decisions, or outcomes.

Your job is to extract transfer-relevant structure:
- projects or work areas
- continuity risks
- unanswered handoff questions
- approximate evidence coverage by category

Important rules:
1. Distinguish what the source states from what still requires employee verification.
2. Preserve decision rationale, tradeoffs, rejected approaches, dependencies, exceptions, and open work when present.
3. If evidence is weak, lower coverage instead of guessing.
4. Prefer 1-6 useful items over long generic lists.
5. Gaps should become specific interview questions that a successor would benefit from.
6. Return JSON only.

Return this shape:
{
  "summary": string,
  "extracted": string[],
  "projects": [{"name": string, "state": string, "ownership": string, "evidence": number}],
  "risks": [{"title": string, "detail": string, "severity": "High"|"Medium"}],
  "gaps": [{"question": string, "topic": string, "priority": "Critical"|"Important"}],
  "coverage": {
    "responsibilities": number,
    "activeWork": number,
    "decisions": number,
    "tacitKnowledge": number,
    "ownership": number
  }
}`;

export type { ModelReconstruction };
