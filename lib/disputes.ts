import type { DisputePair, KnowledgeRecord } from "./types";

const NAME_RE =
  /\b(Musa|Chidi|Alhaji|Grace|Durojaiye|Emeka|Tunde|Bola|Mama Tyre)\b/gi;

const NEG =
  /\b(do not|don't|dont|never|shouldn't|should not|cannot|can't|cant|avoid|not use|not give|don't give|do not give|no longer|stop using)\b/i;

const POS =
  /\b(can take|can use|should use|use |give |allow|allowed|ok for|okay for|first call|remains|is the one)\b/i;

export function namesInText(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(NAME_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[1] ?? m[0];
    found.add(canonicalName(raw));
  }
  return [...found];
}

export function canonicalName(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "mama tyre") return "Mama Tyre";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function sentencesAbout(text: string, name: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => new RegExp(`\\b${name}\\b`, "i").test(s));
}

export type Polarity = "neg" | "pos" | "none";

export function polarityToward(text: string, name: string): Polarity {
  const bits = sentencesAbout(text, name);
  const blob = bits.length ? bits.join(" ") : text;
  const hasName = new RegExp(`\\b${name}\\b`, "i").test(blob);
  if (!hasName) return "none";
  const neg = NEG.test(blob);
  const pos = POS.test(blob);
  if (neg && !pos) return "neg";
  if (pos && !neg) return "pos";
  if (neg && pos) {
    const nameIdx = blob.toLowerCase().indexOf(name.toLowerCase());
    const window = blob.slice(Math.max(0, nameIdx - 40), nameIdx + name.length + 40);
    if (NEG.test(window)) return "neg";
    if (POS.test(window)) return "pos";
  }
  return "none";
}

export function subjectsOf(record: KnowledgeRecord): string[] {
  const fromField = record.peopleMentioned.map(canonicalName);
  const fromText = namesInText(`${record.knowledge} ${record.reasoning}`);
  return [...new Set([...fromField.map(canonicalName), ...fromText])];
}

export function findDisputes(records: KnowledgeRecord[]): DisputePair[] {
  const bySubject = new Map<string, { rec: KnowledgeRecord; pol: Polarity }[]>();
  for (const rec of records) {
    for (const subject of subjectsOf(rec)) {
      const pol = polarityToward(rec.knowledge, subject);
      if (pol === "none") continue;
      const list = bySubject.get(subject) ?? [];
      list.push({ rec, pol });
      bySubject.set(subject, list);
    }
  }

  const pairs: DisputePair[] = [];
  const seen = new Set<string>();
  for (const [subject, entries] of bySubject) {
    const neg = entries.filter((e) => e.pol === "neg");
    const pos = entries.filter((e) => e.pol === "pos");
    for (const n of neg) {
      for (const p of pos) {
        if (n.rec.id === p.rec.id) continue;
        const key = [n.rec.id, p.rec.id].sort().join(":");
        if (seen.has(`${subject}:${key}`)) continue;
        seen.add(`${subject}:${key}`);
        pairs.push({
          subject,
          records: [n.rec, p.rec],
        });
      }
    }
  }
  return pairs;
}

export function disputesFor(
  record: KnowledgeRecord,
  records: KnowledgeRecord[],
): DisputePair[] {
  return findDisputes(records).filter((d) =>
    d.records.some((r) => r.id === record.id),
  );
}

export function wouldDispute(
  draft: Pick<KnowledgeRecord, "knowledge" | "peopleMentioned" | "reasoning">,
  records: KnowledgeRecord[],
): DisputePair[] {
  const phantom: KnowledgeRecord = {
    id: "__draft__",
    knowledge: draft.knowledge,
    reasoning: draft.reasoning,
    topic: "warnings",
    peopleMentioned: draft.peopleMentioned,
    sourcePersonId: "draft",
    capturedAt: new Date().toISOString(),
    confidence: "medium",
  };
  return findDisputes([...records, phantom]).filter((d) =>
    d.records.some((r) => r.id === "__draft__"),
  );
}
