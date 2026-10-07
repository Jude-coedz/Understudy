import type { ModelFailureReason, ModelStatus } from "@/lib/model-status";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const LEGACY_FALLBACK_MODEL = "gemini-3.1-flash-lite";
const MODEL_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [450];

type CompletionOptions = {
  timeoutMs?: number;
  maxOutputTokens?: number;
  temperature?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export type GeminiCallResult<T> = {
  data: T | null;
  status: ModelStatus;
};

function parseJson<T>(raw: string): T | null {
  const stripped = raw
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function textOf(response: GeminiResponse): string {
  return (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export function runtimeModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function runtimeModels() {
  return [...new Set([runtimeModel(), DEFAULT_MODEL, LEGACY_FALLBACK_MODEL])];
}

export function modelRuntimeInfo() {
  return {
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: runtimeModel(),
  };
}

function failureForStatus(status: number): { reason: ModelFailureReason; retryable: boolean } {
  if (status === 401 || status === 403) return { reason: "authentication", retryable: false };
  if (status === 429) return { reason: "rate_limited", retryable: true };
  if (status >= 500) return { reason: "service_unavailable", retryable: true };
  return { reason: "request_failed", retryable: status === 408 || status === 409 || status === 404 };
}

function shouldTryAnotherModel(status: number) {
  return status === 404 || status === 408 || status === 409 || status === 429 || status >= 500;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContent(
  key: string,
  model: string,
  body: unknown,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function completeJsonDetailed<T>(
  system: string,
  user: string,
  options: CompletionOptions = {},
): Promise<GeminiCallResult<T>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return {
      data: null,
      status: { state: "fallback", reason: "not_configured", retryable: false },
    };
  }

  const models = runtimeModels();
  const timeoutMs = options.timeoutMs ?? MODEL_TIMEOUT_MS;
  let lastStatus: ModelStatus = {
    state: "fallback",
    reason: "request_failed",
    retryable: false,
  };

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await generateContent(
          key,
          model,
          {
            systemInstruction: {
              parts: [{ text: system }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: user }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: options.maxOutputTokens ?? 3500,
              temperature: options.temperature ?? 0.2,
            },
          },
          timeoutMs,
        );

        if (!response.ok) {
          const failure = failureForStatus(response.status);
          lastStatus = {
            state: "fallback",
            reason: failure.reason,
            retryable: failure.retryable,
            status: response.status,
          };

          if (response.status === 401 || response.status === 403) {
            return { data: null, status: lastStatus };
          }

          const canRetrySameModel =
            failure.retryable && attempt < RETRY_DELAYS_MS.length;

          if (canRetrySameModel) {
            await delay(RETRY_DELAYS_MS[attempt]);
            continue;
          }

          if (shouldTryAnotherModel(response.status) && modelIndex < models.length - 1) {
            break;
          }

          return { data: null, status: lastStatus };
        }

        const payload = (await response.json()) as GeminiResponse;
        const raw = textOf(payload);
        if (!raw) {
          lastStatus = {
            state: "fallback",
            reason: "empty_response",
            retryable: true,
          };

          if (attempt < RETRY_DELAYS_MS.length) {
            await delay(RETRY_DELAYS_MS[attempt]);
            continue;
          }

          if (modelIndex < models.length - 1) break;
          return { data: null, status: lastStatus };
        }

        const parsed = parseJson<T>(raw);
        if (!parsed) {
          lastStatus = {
            state: "fallback",
            reason: "invalid_response",
            retryable: true,
          };

          if (attempt < RETRY_DELAYS_MS.length) {
            await delay(RETRY_DELAYS_MS[attempt]);
            continue;
          }

          if (modelIndex < models.length - 1) break;
          return { data: null, status: lastStatus };
        }

        return { data: parsed, status: { state: "ok", retryable: false } };
      } catch {
        lastStatus = {
          state: "fallback",
          reason: "network",
          retryable: true,
        };

        if (attempt < RETRY_DELAYS_MS.length) {
          await delay(RETRY_DELAYS_MS[attempt]);
          continue;
        }

        if (modelIndex < models.length - 1) break;
        return { data: null, status: lastStatus };
      }
    }
  }

  return { data: null, status: lastStatus };
}

export async function completeJson<T>(
  system: string,
  user: string,
): Promise<T | null> {
  return (await completeJsonDetailed<T>(system, user)).data;
}

export async function extractDocumentTextWithGemini(input: {
  mimeType: string;
  base64: string;
  filename: string;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64,
            },
          },
          {
            text: `Extract the readable work content from ${input.filename}. Preserve headings, lists, table meaning, decisions, dates, owners, requirements, risks, and open questions. Return plain text only. Do not summarise or invent missing content.`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "text/plain",
      maxOutputTokens: 8000,
      temperature: 0,
    },
  };

  for (const model of runtimeModels()) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await generateContent(key, model, body, MODEL_TIMEOUT_MS);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) return null;

          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < RETRY_DELAYS_MS.length
          ) {
            await delay(RETRY_DELAYS_MS[attempt]);
            continue;
          }

          break;
        }

        const payload = (await response.json()) as GeminiResponse;
        const text = textOf(payload);
        if (text) return text;
        break;
      } catch {
        if (attempt < RETRY_DELAYS_MS.length) {
          await delay(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }
  }

  return null;
}
