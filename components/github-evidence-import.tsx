"use client";

import { useEffect, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import { getCurrentWorkspace, saveWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import type { Transition } from "@/data/v2-demo";
import { IconGithub, IconSpark } from "./icons";

type Preview = {
  title: string;
  provider: string;
  repository: string;
  contributor: string | null;
  text: string;
  counts: { pullRequests: number; commits: number; issues: number };
};

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 16) {
  const seen = new Set<string>();
  return [...incoming, ...existing].filter((item) => {
    const value = key(item).trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

function metricValue(metrics: Transition["metrics"], label: string) {
  return metrics.find((metric) => metric.label === label)?.value ?? 0;
}

function readiness(metrics: Transition["metrics"]) {
  return Math.round(
    metricValue(metrics, "Responsibilities") * 0.2 +
      metricValue(metrics, "Active work") * 0.2 +
      metricValue(metrics, "Decisions") * 0.2 +
      metricValue(metrics, "Tacit knowledge") * 0.15 +
      metricValue(metrics, "Ownership") * 0.15 +
      metricValue(metrics, "Successor review") * 0.1,
  );
}

function addGithubResult(workspace: PersonalWorkspace, result: ReconstructionResult, text: string) {
  const previous = workspace.transition;
  const priorEvidenceCount = previous.sources.filter((source) => source.kind !== "interview").length;
  const metrics = result.metrics.map((metric) => {
    if (metric.label === "Successor review") return previous.metrics.find((item) => item.label === metric.label) ?? metric;
    const old = previous.metrics.find((item) => item.label === metric.label);
    if (!old || priorEvidenceCount === 0) return metric;
    return { ...metric, value: Math.round((old.value * priorEvidenceCount + metric.value) / (priorEvidenceCount + 1)) };
  });
  const nextReadiness = readiness(metrics);
  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    evidenceCollectionComplete: false,
    evidenceCollectionCompletedAt: undefined,
    roleEvidence: undefined,
    successorReview: workspace.successorReview
      ? { ...workspace.successorReview, status: "pending" as const, acceptedAt: undefined, updatedAt: new Date().toISOString() }
      : undefined,
    transition: {
      ...previous,
      summary: result.summary || previous.summary,
      sources: [...previous.sources, result.source],
      projects: mergeUnique(previous.projects, result.projects, (item) => item.name),
      risks: mergeUnique(previous.risks, result.risks, (item) => item.title, 12),
      gaps: mergeUnique(previous.gaps, result.gaps, (item) => item.question, 16),
      metrics,
      readiness: nextReadiness,
      status: nextReadiness >= 80 ? "Ready for review" as const : nextReadiness >= 55 ? "In progress" as const : "Needs attention" as const,
    },
    sourceBodies: { ...workspace.sourceBodies, [result.source.id]: text },
  } satisfies PersonalWorkspace;
}

export function GithubEvidenceImport() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [repository, setRepository] = useState("");
  const [contributor, setContributor] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWorkspace(getCurrentWorkspace());
  }, []);

  async function inspect() {
    if (!repository.trim() || busy) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      const response = await fetch("/api/github-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository, contributor }),
      });
      const payload = (await response.json()) as Preview & { error?: string };
      if (!response.ok || !payload.text) throw new Error(payload.error || "Could not read this repository.");
      setPreview(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function importEvidence() {
    if (!workspace || !preview || busy) return;
    setBusy(true);
    setMessage("");
    try {
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
            title: preview.title,
            text: preview.text,
            provider: "GitHub",
            kind: "github",
          },
        }),
      });
      const payload = (await response.json()) as { result?: ReconstructionResult; usedModel?: boolean; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not reconstruct GitHub evidence.");
      const next = addGithubResult(workspace, payload.result, preview.text);
      saveWorkspace(next);
      setWorkspace(next);
      setMessage(`${preview.repository} was added as primary evidence. Evidence collection has reopened so the whole role can be synthesized again.`);
      window.setTimeout(() => window.location.assign("/workspace"), 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add GitHub evidence.");
    } finally {
      setBusy(false);
    }
  }

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Create a handoff first</h1>
        <p className="mt-2 text-sm text-muted">GitHub evidence is imported into the currently selected transition.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="max-w-3xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-sm"><IconGithub className="text-foreground" /></div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-subtle">GitHub evidence</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Bring repository activity into this handoff.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Understudy reads a public repository&apos;s README and recent activity. Add a GitHub username to focus the evidence on one contributor instead of treating the whole repository as their work.</p>
      </div>

      {message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted">{message}</div>}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <label className="text-sm font-medium">Repository</label>
            <input value={repository} onChange={(event) => { setRepository(event.target.value); setPreview(null); }} placeholder="owner/repository or https://github.com/owner/repository" className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint" />
            <label className="mt-5 block text-sm font-medium">Contributor username <span className="font-normal text-subtle">optional</span></label>
            <input value={contributor} onChange={(event) => { setContributor(event.target.value); setPreview(null); }} placeholder="e.g. Jude-coedz" className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint" />
            <p className="mt-2 text-xs leading-5 text-subtle">Step 11 intentionally starts with public repositories. Private-repository authorization needs a GitHub App/OAuth permission model rather than asking users for personal access tokens.</p>
            <button onClick={() => void inspect()} disabled={!repository.trim() || busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"><IconGithub /> {busy ? "Reading GitHub…" : "Inspect repository"}</button>
          </div>

          {preview && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-sm font-medium">{preview.title}</p><p className="mt-1 text-xs text-subtle">{preview.contributor ? `Focused on @${preview.contributor}` : "Whole repository activity"}</p></div>
                <div className="flex gap-2 text-xs text-subtle"><span>{preview.counts.pullRequests} PRs</span><span>·</span><span>{preview.counts.commits} commits</span><span>·</span><span>{preview.counts.issues} issues</span></div>
              </div>
              <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-4 font-sans text-xs leading-5 text-muted">{preview.text.slice(0, 6000)}{preview.text.length > 6000 ? "\n\n…preview truncated" : ""}</pre>
              <button onClick={() => void importEvidence()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"><IconSpark /> Add as primary evidence</button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium">Current handoff</p>
            <p className="mt-2 text-sm text-muted">{workspace.transition.person}</p>
            <p className="text-xs text-subtle">{workspace.transition.role} · {workspace.transition.department}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium">What becomes evidence</p>
            <p className="mt-2 text-xs leading-5 text-subtle">Repository context, README, recent pull requests, commits and issues are converted into a primary GitHub source. Understudy then resynthesizes the role with the rest of the evidence set.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
