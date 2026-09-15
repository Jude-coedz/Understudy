export type ModelFailureReason =
  | "not_configured"
  | "authentication"
  | "rate_limited"
  | "service_unavailable"
  | "request_failed"
  | "empty_response"
  | "invalid_response"
  | "network";

export type ModelStatus = {
  state: "ok" | "fallback";
  reason?: ModelFailureReason;
  retryable: boolean;
  status?: number;
};

export function modelStatusCopy(status?: ModelStatus | null) {
  if (!status || status.state === "ok") {
    return {
      title: "Analysed with Gemini",
      body: "Gemini completed the analysis. Review the reconstruction before treating any claim as verified knowledge.",
      retryLabel: null as string | null,
    };
  }

  switch (status.reason) {
    case "not_configured":
      return {
        title: "AI analysis is not configured",
        body: "Understudy preserved the evidence and used its conservative fallback. The evidence is safe, but inferred findings should be reviewed carefully. Configure GEMINI_API_KEY on the deployment before expecting AI reconstruction.",
        retryLabel: null,
      };
    case "authentication":
      return {
        title: "Gemini could not authenticate",
        body: "The configured Gemini credential was rejected. Understudy kept the evidence and used its conservative fallback. The deployment credential needs attention before AI analysis can succeed.",
        retryLabel: null,
      };
    case "rate_limited":
      return {
        title: "Gemini is temporarily rate-limited",
        body: "Your evidence was not lost. Understudy used its conservative fallback so you can keep working, and this analysis can be retried when capacity is available.",
        retryLabel: "Retry Gemini analysis",
      };
    case "service_unavailable":
      return {
        title: "Gemini is temporarily unavailable",
        body: "Your evidence was preserved and Understudy used its conservative fallback. This looks temporary, so retrying the AI analysis is safe.",
        retryLabel: "Retry Gemini analysis",
      };
    case "network":
      return {
        title: "Gemini could not be reached",
        body: "The request did not reach Gemini successfully. Understudy preserved the evidence and used its conservative fallback. Retry when the connection is stable.",
        retryLabel: "Retry Gemini analysis",
      };
    case "empty_response":
    case "invalid_response":
      return {
        title: "Gemini returned an unusable response",
        body: "Understudy rejected the model output instead of trusting it, preserved your evidence, and used its conservative fallback. You can retry the analysis.",
        retryLabel: "Retry Gemini analysis",
      };
    default:
      return {
        title: "Gemini analysis did not complete",
        body: "Understudy preserved your evidence and used its conservative fallback. Review the findings carefully before treating them as verified knowledge.",
        retryLabel: status.retryable ? "Retry Gemini analysis" : null,
      };
  }
}
