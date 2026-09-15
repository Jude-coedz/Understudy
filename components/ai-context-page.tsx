"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import {
  getCurrentWorkspace,
  saveWorkspace,
  type PersonalWorkspace,
} from "@/lib/personal-workspace";
import type { Transition } from "@/data/v2-demo";
import { AI_CONTEXT_SCOPES, type AIContextScope } from "@/lib/ai-context";
import { AIContextImport } from "./ai-context-import";
import { IconCheck, IconChevronRight } from "./icons";

function metricValue(metrics: Transition["metrics"], label: string) {
  return metrics.find((metric) => metric.label === label)?.value ?? 0;
}

function calculateReadiness(metrics: Transition["metrics"]) {
  return Math.round(
    metricValue(metrics, "Responsibilities") * 0.2 +
      metricValue(metrics, "Active work") * 0.2 +
      metricValue(metrics, "Decisions") * 0.2 +
      metricValue(metrics, "Tacit knowledge") * 0.15 +
      metricValue(metrics, "Ownership") * 0.15 +
      metricValue(metrics, "Successor review") * 0.1,
  );
}

function mergePreferExisting<T>(
  existing: T[],
  incoming: T[],
  key: (item: T) => string,
  limit = 12,
) {
  const seen = new Set<string>();
  return [...existing, ...incoming]
    .filter((item) => {
      const value = key(item).trim().toLowerCase();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function evidenceWeight(kind: string) {
  if (kind === "ai-context") return 0.45;
  if (kind === "interview") return 0;
  return 1;
}

function mergeAIContext(
  workspace: PersonalWorkspace,
  result: ReconstructionResult,
  rawText: string,
) {
  const previous = workspace.transition;
  const priorWeight = previous.sources.reduce(
    (total, source) => total + evidenceWeight(source.kind),
    0,
  );
  const incomingWeight = 0.45;
  const hasPrimaryEvidence = previous.sources.some(
    (source) => source.kind === "document" || source.kind === "github",
  );

  const metrics = result.metrics.map((metric) => {
    if (metric.label === "Successor review") {
      return previous.metrics.find((item) => item.label === metric.label) ?? metric;
    }
    const old = previous.metrics.find((item) => item.label === metric.label);
    if (!old || priorWeight === 0) return metric;
    return {
      ...metric,
      value: Math.round(
        (old.value * priorWeight + metric.value * incomingWeight) /
          (priorWeight + incomingWeight),
      ),
    };
  });

  const readiness = calculateReadiness(metrics);
  const transition: Transition = {
    ...previous,
    summary: hasPrimaryEvidence ? previous.summary : result.summary,
    sources: [...previous.sources, result.source],
    projects: mergePreferExisting(previous.projects, result.projects, (item) => item.name),
    risks: mergePreferExisting(previous.risks, result.risks, (item) => item.title, 10),
    gaps: mergePreferExisting(previous.gaps, result.gaps, (item) => item.question, 12),
    metrics,
    readiness,
    status: "Needs attention",
  };

  const now = new Date().toISOString();
  const successorReview = workspace.successorReview
    ? {
        ...workspace.successorReview,
        status: "pending" as const,
        acceptedAt: undefined,
        updatedAt: now,
        checks: {
          roleScope: false,
          activeWork: false,
          ownership: false,
          risks: false,
          openQuestions: false,
        },
      }
    : undefined;

  return {
    ...workspace,
    updatedAt: now,
    transition,
    sourceBodies: {
      ...workspace.sourceBodies,
      [result.source.id]: rawText,
    },
    reviewedSourceIds: [],
    evidenceCollectionComplete: false,
    evidenceCollectionCompletedAt: undefined,
    interviewGapStates: {},
    roleEvidence: undefined,
    successorReview,
  } satisfies PersonalWorkspace;
}

export function AIContextPage() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [importedTitle, setImportedTitle] = useState("");

  useEffect(() => {
    setWorkspace(getCurrentWorkspace());
  }, []);

  const transition = workspace?.transition;
  const primarySourceTitles = useMemo(
    () =>
      transition?.sources
        .filter((source) => source.kind === "document" || source.kind === "github")
        .map((source) => source.title) ?? [],
    [transition],
  );
  const knownWorkAreas = useMemo(
    () => transition?.projects.map((project) => project.name).slice(0, 10) ?? [],
    [transition],
  );

  if (!workspace || !transition) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a handoff first.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          AI context belongs to one specific handoff so recovered history never gets mixed between people.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/handoffs" className="inline-flex rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted">My handoffs</Link>
          <Link href="/" className="inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">New handoff</Link>
        </div>
      </div>
    );
  }

  async function importContext({ assistant, scope, text }: { assistant: string; scope: AIContextScope; text: string }) {
    if (!workspace || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const scopeLabel = AI_CONTEXT_SCOPES.find((item) => item.id === scope)?.label ?? "selected context";
      const response = await fetch("/api/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transition: {
            person: workspace.transition.person,
            role: workspace.transition.role,
            department: workspace.transition.department,
            successor: workspace.transition.successor,
            targetDate: workspace.transition.targetDate,
          },
          source: {
            title: `Recovered ${assistant} context · ${scopeLabel}`,
            text,
            provider: `${assistant} · ${scopeLabel}`,
            kind: "ai-context",
          },
        }),
      });
      const payload = (await response.json()) as {
        result?: ReconstructionResult;
        usedModel?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Could not import the recovered AI context.");
      }

      const next = mergeAIContext(workspace, payload.result, text);
      saveWorkspace(next);
      setWorkspace(next);
      setImportedTitle(payload.result.source.title);
      setMessage(
        `${payload.usedModel ? "Gemini analysed" : "Understudy imported"} the ${scopeLabel.toLowerCase()} recovery from ${assistant}. Because this is new evidence, Collect has been reopened and the previous role synthesis and successor verification were invalidated. Return to the handoff to reconnect the full evidence set.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI context import failed.");
    } finally {
      setBusy(false);
    }
  }

  const aiSources = transition.sources.filter((source) => source.kind === "ai-context");

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-subtle">{transition.person} · {transition.role}</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.04em]">Recover AI work context</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Recover useful work knowledge from an assistant you already used, then bring it back into this handoff without treating the assistant as the source of truth.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/handoffs" className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-3 text-sm text-muted hover:bg-card-hover">My handoffs</Link>
          <Link href="/workspace" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted hover:bg-card-hover">
            Back to handoff <IconChevronRight />
          </Link>
        </div>
      </div>

      {message && (
        <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 text-muted ${importedTitle ? "border-ok/25 bg-ok/5" : "border-border bg-card"}`}>
          {importedTitle && <IconCheck className="mr-2 inline h-4 w-4 text-ok" />}
          {message}
          {importedTitle && (
            <div className="mt-4">
              <Link href="/workspace" className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Return to Collect and reconnect evidence <IconChevronRight /></Link>
            </div>
          )}
        </div>
      )}

      {!importedTitle && workspace.evidenceCollectionComplete && (
        <div className="mt-5 rounded-xl border border-warning/25 bg-warning/5 p-4">
          <p className="text-sm font-medium">You can add AI context even this late in the handoff.</p>
          <p className="mt-1 text-xs leading-5 text-subtle">Because it changes the evidence set, importing it will deliberately reopen Collect, discard the old synthesis, and require the updated sources to be reconnected before interview or successor verification continues.</p>
        </div>
      )}

      <AIContextImport
        transition={transition}
        primarySourceTitles={primarySourceTitles}
        knownWorkAreas={knownWorkAreas}
        busy={busy}
        onImport={importContext}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium">How Understudy treats this evidence</p>
          <div className="mt-3 space-y-2 text-xs leading-5 text-subtle">
            <p>• AI-recovered context is useful for rationale, rejected approaches, lessons, and tacit knowledge.</p>
            <p>• It receives lower evidentiary weight than documents and GitHub artifacts.</p>
            <p>• Ownership, commitments, stakeholders, and current-state claims remain candidates for verification.</p>
            <p>• The selected recovery boundary is preserved in the source provenance so reviewers know what was actually searched.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Recovered context in this handoff</p>
            <span className="text-xs text-subtle">{aiSources.length}</span>
          </div>
          <div className="mt-3 space-y-3">
            {aiSources.length ? (
              aiSources.map((source) => (
                <div key={source.id} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium">{source.title}</p>
                  <p className="mt-1 text-xs text-subtle">{source.provider} · AI-recovered · cross-check required</p>
                </div>
              ))
            ) : (
              <p className="text-xs leading-5 text-subtle">No AI-recovered evidence has been imported for this handoff yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
