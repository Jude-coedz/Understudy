const DEFAULT_MODEL = "gemini-3.1-flash-lite";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function parseJson<T>(raw: string): T | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
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

function runtimeModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function completeJson<T>(
  system: string,
  user: string,
): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const model = runtimeModel();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
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
            maxOutputTokens: 2500,
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as GeminiResponse;
    const raw = textOf(payload);
    if (!raw) return null;

    return parseJson<T>(raw);
  } catch {
    return null;
  }
}

export async function extractDocumentTextWithGemini(input: {
  mimeType: string;
  base64: string;
  filename: string;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = runtimeModel();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
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
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as GeminiResponse;
    return textOf(payload) || null;
  } catch {
    return null;
  }
}
