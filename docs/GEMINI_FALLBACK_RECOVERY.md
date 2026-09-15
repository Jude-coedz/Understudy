# Gemini fallback recovery

Understudy distinguishes model failures instead of treating every failure as a generic unavailable state.

Current reasons:

- `not_configured`
- `authentication`
- `rate_limited`
- `service_unavailable`
- `request_failed`
- `empty_response`
- `invalid_response`
- `network`

The reconstruction and whole-role synthesis APIs return `modelStatus` alongside the conservative fallback result. Evidence is preserved when fallback is used.

Onboarding shows a reason-specific explanation. Retry is offered only for statuses marked `retryable`, such as rate limits, temporary service failures, network failures, empty responses, and invalid model responses. Configuration and authentication failures do not show a misleading retry action.
