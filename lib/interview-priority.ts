import type { Transition } from "@/data/v2-demo";
import type { InterviewGapState } from "@/lib/personal-workspace";

type Gap = Transition["gaps"][number];
type Risk = Transition["risks"][number];

const IMPORTANT_TERMS = /\b(owner|ownership|approve|approval|decision|trade.?off|exception|escalat|depend|risk|blocked|deadline|stakeholder|customer|merchant|access|credential|manual|failure|incident)\b/i;
const STOP = new Set(["the", "and", "for", "that", "with", "from", "what", "when", "where", "which", "this", "should", "would", "could", "about", "into", "your", "their", "have", "does", "still", "need"]);

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3 && !STOP.has(token)),
  );
}

function riskAffinity(gap: Gap, risks: Risk[]) {
  const gapTokens = tokens(`${gap.topic} ${gap.question}`);
  let best = 0;
  for (const risk of risks) {
    const riskTokens = tokens(`${risk.title} ${risk.detail}`);
    let overlap = 0;
    gapTokens.forEach((token) => {
      if (riskTokens.has(token)) overlap += 1;
    });
    if (overlap) best = Math.max(best, overlap * (risk.severity === "High" ? 12 : 7));
  }
  return Math.min(best, 36);
}

export function gapScore(
  gap: Gap,
  risks: Risk[],
  state?: InterviewGapState,
) {
  let score = gap.priority === "Critical" ? 100 : 55;
  score += riskAffinity(gap, risks);
  if (IMPORTANT_TERMS.test(`${gap.topic} ${gap.question}`)) score += 8;
  if (state?.status === "deferred") score -= 35;
  return score;
}

export function isParkedInterviewGap(state?: InterviewGapState) {
  return state?.status === "unknown" || state?.status === "ask-someone";
}

export function isDismissedInterviewGap(state?: InterviewGapState) {
  return state?.status === "not-relevant";
}

export function rankedInterviewGaps(
  gaps: Transition["gaps"],
  risks: Transition["risks"],
  states: Record<string, InterviewGapState>,
) {
  return [...gaps]
    .filter((gap) => !isDismissedInterviewGap(states[gap.question]))
    .filter((gap) => !isParkedInterviewGap(states[gap.question]))
    .sort((a, b) => gapScore(b, risks, states[b.question]) - gapScore(a, risks, states[a.question]));
}

export function focusInterviewGaps(
  gaps: Transition["gaps"],
  risks: Transition["risks"],
  states: Record<string, InterviewGapState>,
  limit = 3,
) {
  return rankedInterviewGaps(gaps, risks, states).slice(0, limit);
}

export function blockingCriticalGaps(
  gaps: Transition["gaps"],
  states: Record<string, InterviewGapState>,
) {
  return gaps.filter(
    (gap) => gap.priority === "Critical" && !isDismissedInterviewGap(states[gap.question]),
  );
}

export function parkedInterviewGaps(
  gaps: Transition["gaps"],
  states: Record<string, InterviewGapState>,
) {
  return gaps.filter((gap) => isParkedInterviewGap(states[gap.question]));
}

export function estimatedInterviewMinutes(questionCount: number) {
  if (!questionCount) return 0;
  return Math.max(1, Math.ceil(questionCount * 1.5));
}
