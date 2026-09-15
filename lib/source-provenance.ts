import type { SourceItem, Transition } from "@/data/v2-demo";
import type { PersonalWorkspace } from "@/lib/personal-workspace";

export type SourceReference = {
  source: SourceItem;
  snippet: string;
  reason: string;
};

type GapWithSources = Transition["gaps"][number] & { sourceIds?: string[] };

function tokens(value: string) {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4 && !["which", "what", "when", "where", "with", "from", "that", "this", "have", "been", "does", "your", "their", "about", "into", "still"].includes(item)),
  )];
}

function snippetAround(body: string, queryTokens: string[], max = 420) {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "Stored source text is unavailable.";
  const lower = text.toLowerCase();
  let index = -1;
  for (const token of queryTokens) {
    const found = lower.indexOf(token);
    if (found >= 0 && (index < 0 || found < index)) index = found;
  }
  if (index < 0) return text.slice(0, max) + (text.length > max ? "…" : "");
  const start = Math.max(0, index - Math.floor(max * 0.28));
  const end = Math.min(text.length, start + max);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function domainMatchScore(name: string, description: string, topic: string, question: string) {
  const query = tokens(`${topic} ${question}`);
  const haystack = `${name} ${description}`.toLowerCase();
  return query.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0) +
    (topic && name.toLowerCase().includes(topic.toLowerCase()) ? 6 : 0);
}

export function domainsForSource(workspace: PersonalWorkspace, sourceId: string) {
  return (workspace.roleEvidence?.domains ?? []).filter((domain) => domain.sourceIds.includes(sourceId));
}

export function relatedSourcesForGap(
  workspace: PersonalWorkspace,
  gap: Transition["gaps"][number],
  limit = 3,
): SourceReference[] {
  const queryTokens = tokens(`${gap.topic} ${gap.question}`);
  const sources = workspace.transition.sources.filter((source) => source.kind !== "interview");
  const byId = new Map(sources.map((source) => [source.id, source]));
  const exactSourceIds = (gap as GapWithSources).sourceIds?.filter((id) => byId.has(id)) ?? [];

  if (exactSourceIds.length) {
    return exactSourceIds
      .map((id) => byId.get(id))
      .filter((source): source is SourceItem => Boolean(source))
      .slice(0, limit)
      .map((source) => ({
        source,
        snippet: snippetAround(workspace.sourceBodies[source.id] ?? "", queryTokens),
        reason: "Directly cited when Understudy created this question",
      }));
  }

  const domainMatches = (workspace.roleEvidence?.domains ?? [])
    .map((domain) => ({
      domain,
      score: domainMatchScore(domain.name, domain.description, gap.topic, gap.question),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const directIds: string[] = [];
  for (const item of domainMatches) {
    for (const id of item.domain.sourceIds) {
      if (!directIds.includes(id)) directIds.push(id);
    }
  }

  const direct = directIds
    .map((id) => byId.get(id))
    .filter((source): source is SourceItem => Boolean(source))
    .slice(0, limit)
    .map((source) => ({
      source,
      snippet: snippetAround(workspace.sourceBodies[source.id] ?? "", queryTokens),
      reason: "Supports the work area this question came from",
    }));

  if (direct.length) return direct;

  const lexical = sources
    .map((source) => {
      const body = workspace.sourceBodies[source.id] ?? "";
      const title = source.title.toLowerCase();
      const lowerBody = body.toLowerCase();
      const score = queryTokens.reduce((total, token) => {
        if (title.includes(token)) return total + 5;
        if (lowerBody.includes(token)) return total + 1;
        return total;
      }, 0);
      return { source, body, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ source, body }) => ({
      source,
      snippet: snippetAround(body, queryTokens),
      reason: "Contains context related to this question",
    }));

  return lexical;
}

export function sourcePreviewSnippet(body: string, max = 720) {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "Stored source text is unavailable.";
  return text.slice(0, max) + (text.length > max ? "…" : "");
}
