import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

function textOf(content: { type: string; text?: string }[]): string {
  return content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
}

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

export async function completeJson<T>(
  system: string,
  user: string,
): Promise<T | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const raw = textOf(msg.content);
    return parseJson<T>(raw);
  } catch {
    return null;
  }
}
