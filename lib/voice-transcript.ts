const SPOKEN_PUNCTUATION: Array<[RegExp, string]> = [
  [/\s+new\s+paragraph\s+/gi, "\n\n"],
  [/\s+new\s+line\s+/gi, "\n"],
  [/\s+question\s+mark\b/gi, "?"],
  [/\s+exclamation\s+(?:mark|point)\b/gi, "!"],
  [/\s+full\s+stop\b/gi, "."],
  [/\s+semi\s*colon\b/gi, ";"],
  [/\s+colon\b/gi, ":"],
  [/\s+comma\b/gi, ","],
];

function normalizeSpokenDots(value: string) {
  let next = value;
  let previous = "";

  while (next !== previous) {
    previous = next;
    next = next.replace(
      /\b([a-z])\s+(?:dot|period)\s+(?=[a-z](?:\s+(?:dot|period)\s+[a-z])*\b)/gi,
      "$1.",
    );
  }

  return next.replace(/\b(?:[a-z]\.)+[a-z]\b/gi, (match) => match.toUpperCase());
}

function normalizeSpelledInitialism(value: string) {
  return value.replace(/\b(?:[a-z]\s+){2,}[a-z]\b/gi, (match) =>
    match.replace(/\s+/g, "").toUpperCase(),
  );
}

function normalizeSpacing(value: string) {
  return value
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([,;:!?])(?=[A-Za-z0-9])/g, "$1 ")
    .replace(/\.(?=[A-Za-z0-9])/g, ". ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function capitalizeSentences(value: string) {
  return value.replace(/(^|[.!?]\s+|\n+)([a-z])/g, (_, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}

/**
 * Best-effort cleanup for browser speech recognition.
 * This intentionally formats rather than rewrites: no summarisation,
 * vocabulary substitution, or semantic guessing.
 */
export function normalizeVoiceTranscript(value: string) {
  let next = ` ${value.trim()} `;

  next = normalizeSpokenDots(next);
  next = normalizeSpelledInitialism(next);

  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) {
    next = next.replace(pattern, replacement);
  }

  return capitalizeSentences(normalizeSpacing(next));
}
