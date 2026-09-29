import { NextResponse } from "next/server";
import { completeJsonDetailed } from "@/lib/llm";
import type { ModelStatus } from "@/lib/model-status";
import { answerWorkspaceMetadata } from "@/lib/workspace-metadata-answer";
import {
  WORKSPACE_ASK_SYSTEM,
  fallbackWorkspaceAnswer,
  retrieveWorkspaceEvidence,
  type WorkspaceAskContext,
  type WorkspaceAskResponse,
} from "@/lib/workspace-ask";

type RetrievedEvidence = {
  sourceId: string;
  title: string;
  provider: string;
  kind: string;
  excerpt: string;
  text: string;
};

type AskBody = {
  question?: string;
  context?: WorkspaceAskContext;
  retrievedEvidence?: RetrievedEvidence[];
};

type ModelAnswer = {
  answer?: string;
  unknown?: boolean;
  gap?: string | null;
  citationIds?: string[];
};

function validContext(value: WorkspaceAskContext | undefined): value is WorkspaceAskContext {
  return Boolean(
    value?.workspaceId &&
      value.transition?.person &&
      value.transition?.role &&
      Array.isArray(value.sources),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as AskBody;
  const question = (body.question ?? "").trim();

  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  if (!validContext(body.context)) {
    return NextResponse.json({ error: "No active Understudy workspace was supplied." }, { status: 400 });
  }

  const context = body.context;
  const metadataAnswer = answerWorkspaceMetadata(question, context);
  if (metadataAnswer) return NextResponse.json(metadataAnswer);

  const clientEvidence = Array.isArray(body.retrievedEvidence)
    ? body.retrievedEvidence
        .filter((item) => item?.sourceId && item?.title && item?.text)
        .slice(0, 8)
    : [];

  const chunks = clientEvidence.length
    ? clientEvidence.map((item, index) => ({
        sourceId: item.sourceId,
        title: item.title,
        provider: item.provider,
        kind: item.kind,
        excerpt: item.excerpt || item.text.slice(0, 320),
        text: item.text.slice(0, 2200),
        score: 100 - index,
      }))
    : retrieveWorkspaceEvidence(question, context);

  const fallback = fallbackWorkspaceAnswer(question, context, chunks);
  if (!chunks.length) return NextResponse.json(fallback);

  const evidence = chunks.map((chunk, index) => ({
    rank: index + 1,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.title,
    provider: chunk.provider,
    kind: chunk.kind,
    excerpt: chunk.text,
  }));

  const transitionMetadata = {
    person: context.transition.person,
    role: context.transition.role,
    department: context.transition.department,
    successor: context.transition.successor,
    targetDate: context.transition.targetDate,
    currentSummary: context.transition.summary,
    reconstructedProjects: context.transition.projects,
    reconstructedRisks: context.transition.risks,
    unresolvedGaps: context.transition.gaps,
    sourceCount: context.sources.filter((source) => source.kind !== "interview").length,
    sourceTitles: context.sources.filter((source) => source.kind !== "interview").map((source) => source.title),
  };

  const llm = await completeJsonDetailed<ModelAnswer>(
    WORKSPACE_ASK_SYSTEM,
    `Question:\n${question}\n\nTransition metadata:\n${JSON.stringify(transitionMetadata, null, 2)}\n\nRetrieved workspace evidence:\n${JSON.stringify(evidence, null, 2)}`,
    {
      timeoutMs: 30_000,
      maxOutputTokens: 1_800,
      temperature: 0.15,
    },
  );

  if (!llm.data) {
    return NextResponse.json({
      ...fallback,
      modelStatus: llm.status,
    });
  }

  const model = llm.data;

  const availableIds = new Set(chunks.map((chunk) => chunk.sourceId));
  const citationIds = Array.isArray(model.citationIds)
    ? [...new Set(model.citationIds.filter((id): id is string => typeof id === "string" && availableIds.has(id)))]
    : [];

  const citations = citationIds
    .map((id) => chunks.find((chunk) => chunk.sourceId === id))
    .filter((chunk): chunk is (typeof chunks)[number] => Boolean(chunk))
    .map(({ sourceId, title, provider, kind, excerpt }) => ({ sourceId, title, provider, kind, excerpt }));

  const unknown = Boolean(model.unknown);
  const answer = (model.answer ?? "").trim();
  const gap = typeof model.gap === "string" && model.gap.trim() ? model.gap.trim() : null;

  if (!unknown && (!answer || !citations.length)) {
    return NextResponse.json({
      question,
      answer: "",
      unknown: true,
      gap: "Understudy found related material but could not ground a reliable answer in a specific workspace source.",
      citations: chunks.slice(0, 3).map(({ sourceId, title, provider, kind, excerpt }) => ({ sourceId, title, provider, kind, excerpt })),
      usedModel: true,
    } satisfies WorkspaceAskResponse);
  }

  return NextResponse.json({
    question,
    answer: unknown ? "" : answer,
    unknown,
    gap: unknown ? gap || "The current evidence does not answer this clearly enough." : null,
    citations: unknown ? citations : citations.slice(0, 5),
    usedModel: true,
    modelStatus: llm.status,
  } satisfies WorkspaceAskResponse & { modelStatus: ModelStatus });
}
