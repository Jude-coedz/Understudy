export const TOPICS = [
  "delivery-routes",
  "suppliers",
  "customer-handling",
  "vehicle-maintenance",
  "generator",
  "payments",
  "warnings",
  "office",
] as const;

export type Topic = (typeof TOPICS)[number];

export type Confidence = "high" | "medium" | "low";

export type Person = {
  id: string;
  name: string;
  role: string;
  tenure: string;
};

export type KnowledgeRecord = {
  id: string;
  knowledge: string;
  reasoning: string;
  topic: Topic;
  peopleMentioned: string[];
  sourcePersonId: string;
  capturedAt: string;
  confidence: Confidence;
};

export type ExtractionDraft = {
  knowledge: string;
  reasoning: string;
  topic: Topic;
  peopleMentioned: string[];
  confidence: Confidence;
};

export type CaptureQuestion = {
  question: string;
  askingBecause: string;
  personId: string;
  topic: Topic | null;
  gapKind: GapKind;
};

export type GapKind = "disagreement" | "missing" | "thin-why" | "stale";

export type Gap = {
  kind: GapKind;
  personId: string;
  topic: Topic | null;
  askingBecause: string;
  suggestedQuestion: string;
  relatedRecordIds: string[];
};

export type DisputePair = {
  subject: string;
  records: [KnowledgeRecord, KnowledgeRecord];
};

export type Freshness = "fresh" | "aging" | "stale";

export type CoverageDensity = "missing" | "thin" | "dense";

export type CoverageCell = {
  personId: string;
  topic: Topic;
  density: CoverageDensity;
  soleHolder: boolean;
  hasDispute: boolean;
  stale: boolean;
  recordIds: string[];
};

export type Briefing = {
  question: string;
  prose: string;
  unknown: boolean;
  gap: string | null;
  disputes: {
    subject: string;
    sides: {
      recordId: string;
      personName: string;
      knowledge: string;
      reasoning: string;
    }[];
  }[];
};

export type HandoverPack = {
  personId: string;
  personName: string;
  durationWeeks: 1 | 2;
  soleTopics: Topic[];
  whoCovers: { topic: Topic; people: string[] }[];
  disputes: { subject: string; summary: string }[];
  stale: { recordId: string; topic: Topic; knowledge: string }[];
  briefing: string;
};

export type EvalCase = {
  id: string;
  answer: string;
  expectedTopic: Topic;
  expectedPeople: string[];
  whyPhrases: string[];
};

export const TOPIC_LABELS: Record<Topic, string> = {
  "delivery-routes": "Delivery routes",
  suppliers: "Suppliers",
  "customer-handling": "Customer handling",
  "vehicle-maintenance": "Vehicle maintenance",
  generator: "Generator",
  payments: "Payments",
  warnings: "Warnings",
  office: "Office",
};

export const DEMO_BUSINESS = "FastTrack Dispatch";
