import type {
  Briefing,
  CaptureQuestion,
  ExtractionDraft,
  KnowledgeRecord,
  Person,
  Topic,
} from "./types";
import { TOPICS } from "./types";
import { findDisputes, namesInText } from "./disputes";
import { nextGap } from "./gaps";
import { starterQuestion } from "./starters";
import { firstName, personById } from "./seed";
import { relativeTime } from "./time";
import { buildHandover } from "./handover";
import type { HandoverPack } from "./types";

const TOPIC_KEYS: Record<Topic, string[]> = {
  warnings: [
    "musa",
    "urgent job",
    "urgent jobs",
    "sallah",
    "hospital runs",
    "alausa",
    "national id",
    "never send",
  ],
  generator: [
    "lister",
    "generator",
    "diesel",
    "phcn",
    "4:30",
    "4:30pm",
    "starter battery",
    "kerosene",
  ],
  suppliers: [
    "ladipo",
    "alhaji",
    "computer village",
    "spares",
    "taiwan",
    "stall 14",
  ],
  "delivery-routes": [
    "falomo",
    "third mainland",
    "admiralty",
    "ajah",
    "island jobs",
    "surulere",
    "yaba",
    "isolo",
    "coastal road",
    "lekki-epe",
    "bridge",
    "agege",
  ],
  payments: [
    "shop pos",
    " pos",
    "cash-on-delivery",
    "cod",
    "invoice",
    "corporate",
    "signed waybill",
    "photograph",
    "personal accounts",
  ],
  "customer-handling": [
    "durojaiye",
    "grace",
    "housekeeper",
    "parcel",
    "500 naira",
    "₦500",
    "credit",
    "voice note",
    "whatsapp",
    "lekki phase",
    "gate man",
    "pinnock",
  ],
  "vehicle-maintenance": [
    "engine oil",
    "1,200",
    "1200 km",
    "boxer bikes",
    "puncture",
    "mama tyre",
    "wash and chain",
    "oil go black",
    "obalende",
  ],
  office: [
    "blue tin",
    "kettle",
    "night locker",
    "locker",
    "drawer dey",
    "drawer",
    "spare keys",
  ],
};

function classifyTopic(text: string): Topic {
  const hay = text.toLowerCase();
  let best: Topic = "office";
  let bestScore = -1;
  for (const topic of TOPICS) {
    let score = 0;
    for (const key of TOPIC_KEYS[topic]) {
      if (hay.includes(key.toLowerCase())) {
        score += Math.max(2, key.length / 3);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  if (bestScore <= 0) {
    if (/\b(route|road|bridge|island|mainland)\b/i.test(text)) {
      return "delivery-routes";
    }
    if (/\b(customer|parcel|estate)\b/i.test(text)) return "customer-handling";
    if (/\b(bike|oil|tyre|chain)\b/i.test(text)) return "vehicle-maintenance";
  }
  return best;
}

function tidyKnowledge(answer: string): string {
  const trimmed = answer.trim().replace(/\s+/g, " ");
  const first = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  let k = first.trim();
  if (!/[.!?]$/.test(k)) k += ".";
  return k;
}

function confidenceOf(answer: string, people: string[]): ExtractionDraft["confidence"] {
  const specific =
    /\b(\d+|naira|km|pm|am|sallah|luth|ladipo|falomo)\b/i.test(answer) ||
    people.length > 0;
  const long = answer.trim().length > 80;
  if (specific && long) return "high";
  if (specific || long) return "medium";
  return "low";
}

export function extractFallback(answer: string): ExtractionDraft {
  const reasoning = answer.trim();
  const peopleMentioned = namesInText(answer);
  if (/\bdurojaiye\b/i.test(answer) && !peopleMentioned.some((p) => /durojaiye/i.test(p))) {
    peopleMentioned.push("Durojaiye");
  }
  if (/\bgrace\b/i.test(answer) && !peopleMentioned.includes("Grace")) {
    peopleMentioned.push("Grace");
  }
  return {
    knowledge: tidyKnowledge(answer),
    reasoning,
    topic: classifyTopic(answer),
    peopleMentioned,
    confidence: confidenceOf(answer, peopleMentioned),
  };
}

const STOP = new Set([
  "who",
  "what",
  "where",
  "when",
  "whom",
  "which",
  "the",
  "for",
  "and",
  "are",
  "was",
  "were",
  "should",
  "would",
  "could",
  "about",
  "with",
  "from",
  "that",
  "this",
  "have",
  "has",
  "been",
  "they",
  "them",
  "our",
  "you",
  "how",
  "does",
  "did",
  "not",
  "dont",
  "we",
  "use",
  "time",
  "leave",
  "left",
  "take",
  "into",
  "than",
  "just",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function scoreRecord(question: string, record: KnowledgeRecord): number {
  const q = question.toLowerCase();
  const blob = `${record.knowledge} ${record.reasoning} ${record.topic} ${record.peopleMentioned.join(" ")}`.toLowerCase();
  const qWords = tokens(q);
  const blobWords = tokens(blob);
  let score = 0;
  for (const w of qWords) {
    if (blobWords.has(w)) score += 1;
  }
  if (/\burgent\b/.test(q) && /\burgent\b/.test(blob)) score += 4;
  if (/\bmusa\b/.test(q) && /\bmusa\b/.test(blob)) score += 5;
  if (/\bchidi\b/.test(q) && /\bchidi\b/.test(blob)) score += 3;
  if (/\b(generator|lister)\b/.test(q) && /\b(lister|generator)\b/.test(blob)) {
    score += 4;
  }
  return score;
}

export function citationFor(
  record: KnowledgeRecord,
  people: Person[],
): string {
  const person = personById(people, record.sourcePersonId);
  return `{{${record.id}|${firstName(person?.name ?? record.sourcePersonId)}|${relativeTime(record.capturedAt)}}}`;
}

export function askFallback(
  question: string,
  records: KnowledgeRecord[],
  people: Person[],
): Briefing {
  const q = question.trim();
  if (!q) {
    return {
      question: q,
      prose: "",
      unknown: true,
      gap: "Ask a question about how the shop actually runs.",
      disputes: [],
    };
  }

  const scored = records
    .map((r) => ({ r, score: scoreRecord(q, r) }))
    .sort((a, b) => b.score - a.score);

  const picked = new Map<string, KnowledgeRecord>();
  for (const s of scored) {
    if (s.score >= 3) picked.set(s.r.id, s.r);
  }

  const looksUrgent = /\b(urgent|musa|shouldn'?t|should not|who .*use)\b/i.test(q);
  if (looksUrgent) {
    for (const r of records) {
      if (/\bMusa\b/i.test(`${r.knowledge} ${r.reasoning}`)) {
        picked.set(r.id, r);
      }
    }
  }

  const disputes = findDisputes(records).filter((d) =>
    d.records.some((r) => picked.has(r.id)),
  );
  for (const d of disputes) {
    picked.set(d.records[0].id, d.records[0]);
    picked.set(d.records[1].id, d.records[1]);
  }

  const selected = [...picked.values()];
  const best = scored[0]?.score ?? 0;
  if (selected.length === 0 || (best < 3 && !looksUrgent)) {
    return {
      question: q,
      prose: "",
      unknown: true,
      gap: `Nothing filed matches “${q}”. That is a gap — capture it from someone who does the work. Do not guess.`,
      disputes: [],
    };
  }

  const disputeBlocks = disputes.map((d) => ({
    subject: d.subject,
    sides: d.records.map((r) => {
      const p = personById(people, r.sourcePersonId);
      return {
        recordId: r.id,
        personName: p?.name ?? r.sourcePersonId,
        knowledge: r.knowledge,
        reasoning: r.reasoning,
      };
    }),
  }));

  const lines: string[] = [];
  if (disputeBlocks.length) {
    lines.push(
      "Two filed answers, not one. Do not average them and do not hide a side.",
    );
    for (const d of disputeBlocks) {
      for (const side of d.sides) {
        const rec = picked.get(side.recordId)!;
        lines.push(
          `${firstName(side.personName)}: ${side.knowledge} ${citationFor(rec, people)}`,
        );
      }
    }
  }

  const disputedIds = new Set(
    disputeBlocks.flatMap((d) => d.sides.map((s) => s.recordId)),
  );
  const extras = selected.filter((r) => !disputedIds.has(r.id)).slice(0, 4);
  for (const r of extras) {
    lines.push(`${r.knowledge} ${citationFor(r, people)}`);
  }

  return {
    question: q,
    prose: lines.join("\n\n"),
    unknown: false,
    gap: null,
    disputes: disputeBlocks,
  };
}

export function nextQuestionFallback(
  people: Person[],
  records: KnowledgeRecord[],
  personId: string,
  topic: Topic | null,
): CaptureQuestion {
  const person = personById(people, personId);
  if (!person) {
    return {
      question: "Reset the demo to load FastTrack Dispatch, or add people first.",
      askingBecause: "The store has no one to interview.",
      personId,
      topic,
      gapKind: "missing",
    };
  }
  const gap = nextGap(people, records, { personId, topic });
  if (gap) {
    return {
      question: gap.suggestedQuestion,
      askingBecause: gap.askingBecause,
      personId: gap.personId,
      topic: gap.topic,
      gapKind: gap.kind,
    };
  }
  const starter = starterQuestion(person, topic);
  return {
    question: starter.question,
    askingBecause: starter.askingBecause,
    personId,
    topic,
    gapKind: "missing",
  };
}

export function handoverFallback(
  people: Person[],
  records: KnowledgeRecord[],
  personId: string,
  durationWeeks: 1 | 2,
): HandoverPack | null {
  return buildHandover(people, records, personId, durationWeeks);
}
