export type WorkspaceAskSource = {
  id: string;
  title: string;
  provider: string;
  kind: string;
  body: string;
};

export type WorkspaceAskContext = {
  workspaceId: string;
  transition: {
    person: string;
    role: string;
    department: string;
    successor: string;
    targetDate: string;
    summary: string;
    projects: Array<{ name: string; state: string; ownership: string; evidence: number }>;
    risks: Array<{ title: string; detail: string; severity: string }>;
    gaps: Array<{ question: string; topic: string; priority: string }>;
  };
  sources: WorkspaceAskSource[];
};

export type WorkspaceAskCitation = {
  sourceId: string;
  title: string;
  provider: string;
  kind: string;
  excerpt: string;
};

export type WorkspaceAskResponse = {
  question: string;
  answer: string;
  unknown: boolean;
  gap: string | null;
  citations: WorkspaceAskCitation[];
  usedModel: boolean;
};

type EvidenceChunk = WorkspaceAskCitation & {
  text: string;
  score: number;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "can", "could",
  "did", "do", "does", "for", "from", "had", "has", "have", "how", "i", "if", "in", "into",
  "is", "it", "its", "me", "of", "on", "or", "our", "should", "that", "the", "their", "them",
  "there", "these", "they", "this", "to", "was", "we", "were", "what", "when", "where", "which",
  "who", "why", "will", "with", "would", "you", "your",
]);

function terms(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function splitIntoChunks(text: string, maxChars = 1800) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += maxChars - 180) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }

    if (!current) {
      current = paragraph;
      continue;
    }

    if (current.length + paragraph.length + 2 <= maxChars) {
      current += `\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function scoreChunk(questionTerms: string[], title: string, text: string) {
  if (!questionTerms.length) return 0;
  const titleTerms = new Set(terms(title));
  const body = text.toLowerCase();
  let score = 0;

  for (const term of questionTerms) {
    if (titleTerms.has(term)) score += 5;
    const matches = body.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
    score += Math.min(matches?.length ?? 0, 5);
  }

  return score;
}

function excerptOf(text: string, questionTerms: string[]) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 320) return compact;

  const lower = compact.toLowerCase();
  const indexes = questionTerms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const center = indexes[0] ?? 0;
  const start = Math.max(0, center - 90);
  const end = Math.min(compact.length, start + 320);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

export function retrieveWorkspaceEvidence(question: string, context: WorkspaceAskContext, limit = 8) {
  const questionTerms = terms(question);
  const chunks: EvidenceChunk[] = [];

  for (const source of context.sources) {
    const sourceChunks = splitIntoChunks(source.body.slice(0, 60_000));
    sourceChunks.forEach((text, index) => {
      chunks.push({
        sourceId: source.id,
        title: source.title,
        provider: source.provider,
        kind: source.kind,
        text,
        excerpt: excerptOf(text, questionTerms),
        score: scoreChunk(questionTerms, source.title, text) + (index === 0 ? 0.25 : 0),
      });
    });
  }

  const ranked = chunks.sort((a, b) => b.score - a.score);
  const positive = ranked.filter((chunk) => chunk.score > 0);
  const selected = positive.length ? positive.slice(0, limit) : ranked.slice(0, Math.min(limit, context.sources.length));

  return selected;
}

export function fallbackWorkspaceAnswer(question: string, context: WorkspaceAskContext, chunks: EvidenceChunk[]): WorkspaceAskResponse {
  if (!context.sources.length || !chunks.length) {
    return {
      question,
      answer: "",
      unknown: true,
      gap: "Understudy does not have enough workspace evidence to answer that yet. Add another source or capture the missing context in the interview.",
      citations: [],
      usedModel: false,
    };
  }

  const top = chunks.slice(0, 3);
  return {
    question,
    answer: `I found relevant evidence, but Gemini was unavailable to synthesize it safely. Review the cited source${top.length === 1 ? "" : "s"} below rather than treating an extracted sentence as a complete answer.`,
    unknown: false,
    gap: null,
    citations: top.map(({ sourceId, title, provider, kind, excerpt }) => ({ sourceId, title, provider, kind, excerpt })),
    usedModel: false,
  };
}

export const WORKSPACE_ASK_SYSTEM = `You are Understudy's evidence-grounded handoff assistant.

Answer questions about one work-transition workspace using ONLY the supplied evidence excerpts and transition metadata. Never use outside knowledge, assumptions, or generic best practices to fill a gap.

Rules:
1. Every factual claim about the work must be supported by the supplied evidence.
2. If the evidence is insufficient, set unknown=true and say exactly what is missing.
3. Do not turn an inference into a fact. Qualify uncertainty explicitly.
4. Prefer concise successor-useful answers over long summaries.
5. Cite only source IDs that actually support the answer.
6. Reconstructed projects, risks, and gaps are working hypotheses; primary source text is stronger evidence.
7. Do not invent dates, owners, decisions, outcomes, metrics, or stakeholders.

Return JSON only:
{
  "answer": string,
  "unknown": boolean,
  "gap": string | null,
  "citationIds": string[]
}`;
