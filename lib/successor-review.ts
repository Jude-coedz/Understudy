import type { Transition } from "@/data/v2-demo";

export type SuccessorReviewCheckKey =
  | "roleScope"
  | "activeWork"
  | "ownership"
  | "risks"
  | "openQuestions";

export type SuccessorReview = {
  status: "pending" | "changes-requested" | "accepted";
  reviewerName: string;
  startedAt: string;
  updatedAt: string;
  acceptedAt?: string;
  checks: Record<SuccessorReviewCheckKey, boolean>;
  notes: string;
  submittedQuestions: string[];
};

export const SUCCESSOR_REVIEW_CHECKS: Array<{
  key: SuccessorReviewCheckKey;
  label: string;
  description: string;
}> = [
  {
    key: "roleScope",
    label: "I understand the role scope",
    description: "The responsibilities and boundaries of the handoff are clear enough to continue the role.",
  },
  {
    key: "activeWork",
    label: "I understand the active work",
    description: "I know what is in progress, what state it is in, and what needs attention next.",
  },
  {
    key: "ownership",
    label: "I know what I own",
    description: "Ownership and escalation paths are explicit enough that I know where decisions should go.",
  },
  {
    key: "risks",
    label: "I reviewed the continuity risks",
    description: "Known dependencies, fragile processes, exceptions, and unresolved risks have been reviewed.",
  },
  {
    key: "openQuestions",
    label: "I reviewed the open questions",
    description: "I know which questions remain open and which ones can be resolved after the transition.",
  },
];

export function reviewCompletion(review?: SuccessorReview) {
  if (!review) return 0;
  const completed = SUCCESSOR_REVIEW_CHECKS.filter((item) => review.checks[item.key]).length;
  return Math.round((completed / SUCCESSOR_REVIEW_CHECKS.length) * 100);
}

export function readinessFromMetrics(metrics: Transition["metrics"]) {
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

export function applyReviewMetric(transition: Transition, review: SuccessorReview): Transition {
  const completion = review.status === "accepted" ? 100 : reviewCompletion(review);
  const metrics = transition.metrics.map((metric) =>
    metric.label === "Successor review"
      ? {
          ...metric,
          value: completion,
          note:
            review.status === "accepted"
              ? `Accepted by ${review.reviewerName}`
              : review.status === "changes-requested"
                ? "Changes requested"
                : `${completion}% of review checklist`,
        }
      : metric,
  );
  const readiness = readinessFromMetrics(metrics);
  return {
    ...transition,
    metrics,
    readiness,
    status:
      review.status === "accepted" && readiness >= 80
        ? "Ready for review"
        : readiness >= 55
          ? "In progress"
          : "Needs attention",
  };
}
