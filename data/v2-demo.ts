export type EvidenceKind = "document" | "github" | "ai-context" | "interview";

export type SourceItem = {
  id: string;
  title: string;
  kind: EvidenceKind;
  provider: string;
  meta: string;
  extracted: string[];
  confidence: "Primary" | "AI-recovered" | "Self-reported";
};

export type ReadinessMetric = {
  label: string;
  value: number;
  note: string;
};

export type Transition = {
  id: string;
  person: string;
  initials: string;
  role: string;
  department: string;
  type: string;
  targetDate: string;
  successor: string;
  successorInitials: string;
  manager: string;
  readiness: number;
  status: "In progress" | "Needs attention" | "Ready for review";
  summary: string;
  metrics: ReadinessMetric[];
  sources: SourceItem[];
  projects: {
    name: string;
    state: string;
    ownership: string;
    evidence: number;
  }[];
  risks: {
    title: string;
    detail: string;
    severity: "High" | "Medium";
  }[];
  gaps: {
    question: string;
    topic: string;
    priority: "Critical" | "Important";
  }[];
};

export const transitions: Transition[] = [
  {
    id: "maya-okafor",
    person: "Maya Okafor",
    initials: "MO",
    role: "Senior Product Manager",
    department: "Product",
    type: "Role transition",
    targetDate: "Sep 30, 2026",
    successor: "Daniel Cole",
    successorInitials: "DC",
    manager: "Aisha Bello",
    readiness: 78,
    status: "In progress",
    summary:
      "Maya owns the merchant activation and payments roadmap. Understudy has reconstructed four major initiatives and identified several product decisions whose rationale is not present in the primary documentation.",
    metrics: [
      { label: "Responsibilities", value: 96, note: "12 of 13 mapped" },
      { label: "Active work", value: 84, note: "4 projects reconstructed" },
      { label: "Decisions", value: 72, note: "9 need verification" },
      { label: "Tacit knowledge", value: 58, note: "Interview incomplete" },
      { label: "Ownership", value: 76, note: "3 items unassigned" },
      { label: "Successor review", value: 44, note: "7 questions open" },
    ],
    sources: [
      {
        id: "prd-approval",
        title: "Enterprise Approval Workflows — PRD",
        kind: "document",
        provider: "Uploaded document",
        meta: "PRD · updated Aug 28",
        extracted: ["4 decisions", "6 requirements", "2 open questions"],
        confidence: "Primary",
      },
      {
        id: "merchant-research",
        title: "Merchant onboarding research synthesis",
        kind: "document",
        provider: "Uploaded document",
        meta: "Research · updated Jul 19",
        extracted: ["3 insights", "5 customer constraints", "2 risks"],
        confidence: "Primary",
      },
      {
        id: "payments-roadmap",
        title: "Payments roadmap — H2 2026",
        kind: "document",
        provider: "Uploaded document",
        meta: "Roadmap · updated Sep 02",
        extracted: ["4 initiatives", "8 milestones", "5 owners"],
        confidence: "Primary",
      },
      {
        id: "github-console",
        title: "northstar/merchant-console",
        kind: "github",
        provider: "GitHub",
        meta: "Repository · 28 relevant PRs",
        extracted: ["3 product areas", "11 linked changes", "4 release notes"],
        confidence: "Primary",
      },
      {
        id: "chatgpt-context",
        title: "Recovered AI work context",
        kind: "ai-context",
        provider: "ChatGPT",
        meta: "Imported Sep 14 · employee reviewed",
        extracted: ["6 decisions", "4 rejected approaches", "7 lessons"],
        confidence: "AI-recovered",
      },
      {
        id: "handoff-interview",
        title: "Handoff interview — session 1",
        kind: "interview",
        provider: "Understudy",
        meta: "Interview · 18 minutes",
        extracted: ["5 clarifications", "3 new risks", "2 relationships"],
        confidence: "Self-reported",
      },
    ],
    projects: [
      { name: "Enterprise Approval Workflows", state: "In build", ownership: "Maya → Daniel", evidence: 92 },
      { name: "Merchant Onboarding v2", state: "Rollout", ownership: "Maya → Daniel", evidence: 86 },
      { name: "Refund Automation", state: "Discovery", ownership: "Unassigned", evidence: 63 },
      { name: "Payments Reliability", state: "Ongoing", ownership: "Product + Eng", evidence: 78 },
    ],
    risks: [
      {
        title: "Approval workflow rationale is partially undocumented",
        detail: "The PRD captures what shipped, but the reason configurable workflows were deferred only appears in recovered AI context and Maya's interview.",
        severity: "High",
      },
      {
        title: "Refund Automation has no successor owner",
        detail: "Discovery is active and two stakeholder commitments are due after Maya's target transition date.",
        severity: "High",
      },
      {
        title: "Enterprise merchant escalation path is person-dependent",
        detail: "The current process references Maya and one solutions lead directly rather than a durable role or queue.",
        severity: "Medium",
      },
    ],
    gaps: [
      {
        question: "What would need to be true before configurable approval workflows should be reconsidered?",
        topic: "Enterprise Approval Workflows",
        priority: "Critical",
      },
      {
        question: "Who should own the next discovery decision for Refund Automation?",
        topic: "Refund Automation",
        priority: "Critical",
      },
      {
        question: "Which enterprise merchant expectations are not visible in the roadmap or PRDs?",
        topic: "Stakeholder context",
        priority: "Important",
      },
    ],
  },
  {
    id: "tobi-adeyemi",
    person: "Tobi Adeyemi",
    initials: "TA",
    role: "Backend Engineer",
    department: "Engineering",
    type: "Departure",
    targetDate: "Oct 04, 2026",
    successor: "Engineering team",
    successorInitials: "EN",
    manager: "Nora King",
    readiness: 54,
    status: "Needs attention",
    summary: "Tobi is the dominant recent contributor to settlement and reconciliation services.",
    metrics: [
      { label: "Responsibilities", value: 82, note: "8 of 10 mapped" },
      { label: "Active work", value: 76, note: "5 services detected" },
      { label: "Decisions", value: 41, note: "Architecture context missing" },
      { label: "Tacit knowledge", value: 28, note: "Interview not started" },
      { label: "Ownership", value: 52, note: "2 systems lack backup" },
      { label: "Successor review", value: 14, note: "Not started" },
    ],
    sources: [],
    projects: [],
    risks: [],
    gaps: [],
  },
  {
    id: "leila-hassan",
    person: "Leila Hassan",
    initials: "LH",
    role: "Customer Operations Lead",
    department: "Operations",
    type: "Internal transfer",
    targetDate: "Oct 18, 2026",
    successor: "Kemi Falana",
    successorInitials: "KF",
    manager: "Omar Yusuf",
    readiness: 91,
    status: "Ready for review",
    summary: "Leila's transition is almost complete and waiting on successor verification.",
    metrics: [
      { label: "Responsibilities", value: 100, note: "Complete" },
      { label: "Active work", value: 96, note: "Complete" },
      { label: "Decisions", value: 91, note: "1 review item" },
      { label: "Tacit knowledge", value: 88, note: "Interview complete" },
      { label: "Ownership", value: 100, note: "Reassigned" },
      { label: "Successor review", value: 72, note: "3 questions open" },
    ],
    sources: [],
    projects: [],
    risks: [],
    gaps: [],
  },
];

export const continuityRisks = [
  {
    area: "Settlement service",
    team: "Engineering",
    owner: "Tobi Adeyemi",
    score: 92,
    detail: "84% of recent changes from one contributor · no runbook detected",
  },
  {
    area: "Enterprise approval workflows",
    team: "Product",
    owner: "Maya Okafor",
    score: 78,
    detail: "Decision rationale concentrated in one employee's work context",
  },
  {
    area: "Merchant escalation playbook",
    team: "Operations",
    owner: "Leila Hassan",
    score: 63,
    detail: "Backup owner exists · 3 undocumented exception paths",
  },
];

export function getTransition(id: string) {
  return transitions.find((transition) => transition.id === id);
}

export function buildAiContextPrompt(person = "Maya Okafor", role = "Senior Product Manager") {
  return `You are helping me prepare a professional work handover for my role as ${role}.

Use ONLY information available from previous conversations, project context, uploaded files, saved context, or chat history you can genuinely access. Do not invent facts, dates, projects, metrics, people, or decisions.

Employee: ${person}
Company: Northstar Labs
Role: ${role}
Period to focus on: 2025–2026

Actively inspect relevant work conversations you can access. Ignore unrelated personal conversations. If you cannot search all previous chats, state that limitation clearly.

Reconstruct my work into these sections:
1. Responsibilities I owned or repeatedly handled.
2. Projects and initiatives: problem, my contribution, outputs, status, collaborators, dates if known.
3. Important decisions: decision, context, why, alternatives, tradeoffs, what happened next.
4. Artifacts discussed or created: PRDs, specs, research, presentations, code, architecture, plans, analyses.
5. Failed or rejected approaches and lessons learned.
6. Open or unresolved work.
7. Risks and non-obvious context a successor could miss.
8. People, teams, vendors, systems, and dependencies that mattered repeatedly.
9. Recurring responsibilities and rituals.
10. Questions you still cannot answer from available evidence.

For every major item, include an approximate conversation title/topic and date where possible, mark whether it is explicit or inferred, and label confidence HIGH, MEDIUM, or LOW.

Preserve WHY decisions were made. It is better to say \"I could not determine this\" than to guess.

Return structured Markdown that another AI system can parse reliably.`;
}
