import type { EvidenceKind, SourceItem, Transition } from "@/data/v2-demo";

export type RoleKnowledgeFacet =
  | "responsibilities"
  | "activeWork"
  | "decisions"
  | "ownership";

export type RoleEvidenceDomainStatus = "Covered" | "Partial" | "Thin";

export type RoleEvidenceDomain = {
  id: string;
  name: string;
  type: "Responsibility" | "Project" | "Process" | "Relationship" | "Decision area";
  description: string;
  sourceIds: string[];
  primarySourceIds: string[];
  supportingSourceIds: string[];
  status: RoleEvidenceDomainStatus;
  covers: RoleKnowledgeFacet[];
  missing: string[];
};

export type RoleEvidenceContradiction = {
  claim: string;
  sourceIds: string[];
};

export type RoleEvidenceModel = {
  synthesizedAt: string;
  usedModel: boolean;
  sourceCount: number;
  overview: string;
  domains: RoleEvidenceDomain[];
  missingAreas: string[];
  contradictions: RoleEvidenceContradiction[];
};

export type WholeRoleSource = {
  id: string;
  title: string;
  kind: EvidenceKind;
  provider: string;
  confidence: SourceItem["confidence"];
  text: string;
};

export type WholeRoleSynthesisInput = {
  transition: Pick<
    Transition,
    "person" | "role" | "department" | "successor" | "targetDate"
  >;
  sources: WholeRoleSource[];
  current?: Pick<Transition, "summary" | "projects" | "risks" | "gaps">;
};

export type WholeRoleModelOutput = {
  overview?: string;
  domains?: Array<{
    name?: string;
    type?: string;
    description?: string;
    sourceIds?: string[];
    covers?: string[];
    missing?: string[];
  }>;
  missingAreas?: string[];
  contradictions?: Array<{
    claim?: string;
    sourceIds?: string[];
  }>;
  projects?: Array<{
    name?: string;
    state?: string;
    ownership?: string;
    sourceIds?: string[];
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
    sourceIds?: string[];
  }>;
};

export type WholeRoleSynthesisResult = {
  evidenceModel: RoleEvidenceModel;
  summary: string;
  projects: Transition["projects"];
  risks: Transition["risks"];
  gaps: Transition["gaps"];
  metrics: Transition["metrics"];
  readiness: number;
};

const FACETS: RoleKnowledgeFacet[] = [
  "responsibilities",
  "activeWork",
  "decisions",
  "ownership",
];

function compact(value: unknown, fallback: string, max = 240) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function uniqueStrings(values: unknown, max = 8) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

function domainType(value: unknown): RoleEvidenceDomain["type"] {
  if (value === "Responsibility" || value === "Project" || value === "Process" || value === "Relationship" || value === "Decision area") return value;
  return "Responsibility";
}

function statusWeight(status: RoleEvidenceDomainStatus) {
  if (status === "Covered") return 100;
  if (status === "Partial") return 60;
  return 25;
}

function evidenceStatus(sourceIds: string[], sources: WholeRoleSource[]): RoleEvidenceDomainStatus {
  const support = sources.filter((source) => sourceIds.includes(source.id));
  const primary = support.filter((source) => source.confidence === "Primary");

  if (primary.length >= 2 || (primary.length >= 1 && support.length >= 2)) return "Covered";
  if (primary.length >= 1 || support.length >= 2) return "Partial";
  return "Thin";
}

function facetCoverage(domains: RoleEvidenceDomain[], facet: RoleKnowledgeFacet) {
  if (!domains.length) return 0;
  const total = domains.reduce(
    (sum, domain) => sum + (domain.covers.includes(facet) ? statusWeight(domain.status) : 0),
    0,
  );
  return Math.round(total / domains.length);
}

function tacitCoverage(domains: RoleEvidenceDomain[], sources: WholeRoleSource[]) {
  if (!domains.length) return 0;
  const total = domains.reduce((sum, domain) => {
    const hasTacitSource = sources.some(
      (source) =>
        domain.sourceIds.includes(source.id) &&
        (source.kind === "ai-context" || source.kind === "interview"),
    );
    return sum + (hasTacitSource ? statusWeight(domain.status) : 0);
  }, 0);
  return Math.round(total / domains.length);
}

function readinessFromMetrics(metrics: Transition["metrics"]) {
  const value = (label: string) => metrics.find((metric) => metric.label === label)?.value ?? 0;
  return Math.round(
    value("Responsibilities") * 0.2 +
      value("Active work") * 0.2 +
      value("Decisions") * 0.2 +
      value("Tacit knowledge") * 0.15 +
      value("Ownership") * 0.15 +
      value("Successor review") * 0.1,
  );
}

function fallbackModel(input: WholeRoleSynthesisInput): WholeRoleModelOutput {
  return {
    overview: `Understudy indexed ${input.sources.length} evidence source${input.sources.length === 1 ? "" : "s"} for ${input.transition.person}'s ${input.transition.role} handoff. Full cross-source synthesis is unavailable in this session, so this view stays source-backed and conservative. You can still review the evidence and continue, but relationships between work areas may be incomplete.`,
    domains: input.sources.slice(0, 12).map((source) => ({
      name: source.title,
      type: "Responsibility",
      description: `Evidence area represented by ${source.title}.`,
      sourceIds: [source.id],
      covers: ["activeWork"],
      missing: ["Cross-source relationships and missing role areas still need human review."],
    })),
    missingAreas: [
      "Full cross-source synthesis is unavailable in this session. Review whether recurring responsibilities, stakeholders, decisions, and operational exceptions are represented.",
    ],
    contradictions: [],
    projects: input.current?.projects?.map((project) => ({
      name: project.name,
      state: project.state,
      ownership: project.ownership,
      sourceIds: [],
    })) ?? [],
    risks: input.current?.risks ?? [],
    gaps: input.current?.gaps ?? [],
  };
}

export function normalizeWholeRoleSynthesis(
  input: WholeRoleSynthesisInput,
  raw: WholeRoleModelOutput | null,
  usedModel: boolean,
): WholeRoleSynthesisResult {
  const model = raw ?? fallbackModel(input);
  const validSourceIds = new Set(input.sources.map((source) => source.id));

  const domains = (model.domains ?? [])
    .filter((domain) => domain?.name)
    .slice(0, 16)
    .map((domain, index): RoleEvidenceDomain => {
      const sourceIds = uniqueStrings(domain.sourceIds, 12).filter((id) => validSourceIds.has(id));
      const support = input.sources.filter((source) => sourceIds.includes(source.id));
      const primarySourceIds = support.filter((source) => source.confidence === "Primary").map((source) => source.id);
      const covers = uniqueStrings(domain.covers, 4).filter((facet): facet is RoleKnowledgeFacet => FACETS.includes(facet as RoleKnowledgeFacet));
      return {
        id: `domain-${index}-${compact(domain.name, "work-area", 40).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: compact(domain.name, `Work area ${index + 1}`, 100),
        type: domainType(domain.type),
        description: compact(domain.description, "This work area appears in the current evidence set.", 360),
        sourceIds,
        primarySourceIds,
        supportingSourceIds: sourceIds.filter((id) => !primarySourceIds.includes(id)),
        status: evidenceStatus(sourceIds, input.sources),
        covers,
        missing: uniqueStrings(domain.missing, 5),
      };
    });

  const evidenceModel: RoleEvidenceModel = {
    synthesizedAt: new Date().toISOString(),
    usedModel,
    sourceCount: input.sources.length,
    overview: compact(model.overview, `Understudy synthesized ${input.sources.length} sources into a role-level evidence map.`, 700),
    domains,
    missingAreas: uniqueStrings(model.missingAreas, 10),
    contradictions: (model.contradictions ?? [])
      .filter((item) => item?.claim)
      .slice(0, 8)
      .map((item) => ({
        claim: compact(item.claim, "Conflicting evidence", 260),
        sourceIds: uniqueStrings(item.sourceIds, 8).filter((id) => validSourceIds.has(id)),
      })),
  };

  const projectEvidence = (sourceIds: string[]) => {
    const status = evidenceStatus(sourceIds.filter((id) => validSourceIds.has(id)), input.sources);
    return status === "Covered" ? 90 : status === "Partial" ? 60 : 35;
  };

  const projects = (model.projects ?? [])
    .filter((project) => project?.name)
    .slice(0, 12)
    .map((project) => ({
      name: compact(project.name, "Work area", 100),
      state: compact(project.state, "Needs review", 50),
      ownership: compact(project.ownership, "Ownership needs verification", 100),
      evidence: projectEvidence(uniqueStrings(project.sourceIds, 10)),
    }));

  const risks = (model.risks ?? [])
    .filter((risk) => risk?.title)
    .slice(0, 10)
    .map((risk) => ({
      title: compact(risk.title, "Continuity risk", 140),
      detail: compact(risk.detail, "This risk needs verification.", 380),
      severity: risk.severity === "High" ? ("High" as const) : ("Medium" as const),
    }));

  const gaps = (model.gaps ?? [])
    .filter((gap) => gap?.question)
    .slice(0, 12)
    .map((gap) => ({
      question: compact(gap.question, "What important context is still missing?", 240),
      topic: compact(gap.topic, "Role context", 100),
      priority: gap.priority === "Critical" ? ("Critical" as const) : ("Important" as const),
      sourceIds: uniqueStrings(gap.sourceIds, 6).filter((id) => validSourceIds.has(id)),
    }));

  const responsibilities = facetCoverage(domains, "responsibilities");
  const activeWork = facetCoverage(domains, "activeWork");
  const decisions = facetCoverage(domains, "decisions");
  const ownership = facetCoverage(domains, "ownership");
  const tacitKnowledge = tacitCoverage(domains, input.sources);

  const metrics: Transition["metrics"] = [
    { label: "Responsibilities", value: responsibilities, note: `${domains.filter((domain) => domain.covers.includes("responsibilities")).length}/${domains.length || 0} observed domains supported` },
    { label: "Active work", value: activeWork, note: `${domains.filter((domain) => domain.covers.includes("activeWork")).length}/${domains.length || 0} observed domains supported` },
    { label: "Decisions", value: decisions, note: `${domains.filter((domain) => domain.covers.includes("decisions")).length}/${domains.length || 0} observed domains include rationale` },
    { label: "Tacit knowledge", value: tacitKnowledge, note: "Only AI-recovered/interview evidence contributes here" },
    { label: "Ownership", value: ownership, note: `${domains.filter((domain) => domain.covers.includes("ownership")).length}/${domains.length || 0} observed domains include ownership evidence` },
    { label: "Successor review", value: 0, note: "Not reviewed" },
  ];

  return {
    evidenceModel,
    summary: evidenceModel.overview,
    projects,
    risks,
    gaps,
    metrics,
    readiness: readinessFromMetrics(metrics),
  };
}

export const WHOLE_ROLE_SYNTHESIS_SYSTEM = `You are Understudy, an evidence-first work handoff analyst.

You receive ALL currently collected evidence for one role transition at the same time. Your job is to build a role-level evidence map across the set.

Important product rule: document count is NOT completeness. One PRD may deeply cover one feature while saying nothing about seven other months of work. Twenty documents may all describe the same project. You must consolidate evidence into distinct work domains and show what each domain is supported by.

Do not invent a domain merely because the role title usually has it. Domains must appear in the supplied evidence. You may separately suggest likely missing areas as hypotheses based on the role and what is absent, but label them as missing areas rather than established work.

For every observed domain:
- give it a concise name and type
- describe what this person appears to own/do there
- cite exact sourceIds from the supplied evidence
- identify which knowledge facets the evidence actually supports: responsibilities, activeWork, decisions, ownership
- list material missing context inside that domain

For every handoff gap/question:
- ask only something that remains unanswered after considering the full evidence set
- include the exact sourceIds that created or support that unresolved question
- never cite a sourceId that was not supplied
- if the question is a broad hypothesis rather than traceable to a specific source, return an empty sourceIds array rather than inventing provenance

Also:
- consolidate duplicate projects/work areas across sources
- identify contradictions between sources
- preserve provenance
- primary evidence should outweigh AI-recovered context when sources conflict
- do NOT return a percentage for "role completeness" and do NOT claim the whole role is complete

Return JSON only:
{
  "overview": string,
  "domains": [{
    "name": string,
    "type": "Responsibility"|"Project"|"Process"|"Relationship"|"Decision area",
    "description": string,
    "sourceIds": string[],
    "covers": ("responsibilities"|"activeWork"|"decisions"|"ownership")[],
    "missing": string[]
  }],
  "missingAreas": string[],
  "contradictions": [{"claim": string, "sourceIds": string[]}],
  "projects": [{"name": string, "state": string, "ownership": string, "sourceIds": string[]}],
  "risks": [{"title": string, "detail": string, "severity": "High"|"Medium"}],
  "gaps": [{"question": string, "topic": string, "priority": "Critical"|"Important", "sourceIds": string[]}]
}`;
