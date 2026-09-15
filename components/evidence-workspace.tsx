"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import { extractFileText, SUPPORTED_UPLOAD_ACCEPT, SUPPORTED_UPLOAD_LABEL } from "@/lib/file-extraction";
import type { WholeRoleSynthesisResult } from "@/lib/role-evidence";
import {
  getCurrentWorkspace,
  saveIdentity,
  saveWorkspace,
  type PersonalWorkspace,
} from "@/lib/personal-workspace";
import {
  connectGoogleDrive,
  pickGoogleDriveFile,
  readGoogleDriveFile,
} from "@/lib/google-drive";
import {
  blockingCriticalGaps,
  isDismissedInterviewGap,
  rankedInterviewGaps,
} from "@/lib/interview-priority";
import type { EvidenceKind, SourceItem, Transition } from "@/data/v2-demo";
import { AdaptiveInterview } from "./adaptive-interview";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconSpark,
  IconUpload,
} from "./icons";

type Stage = "sources" | "map" | "interview" | "handoff";
type SourceMode = "paste" | "upload" | "drive";

const STAGES: Array<{ key: Stage; label: string; description: string }> = [
  { key: "sources", label: "1. Evidence", description: "Collect the artifacts that represent the work being handed over." },
  { key: "map", label: "2. Reconstruction", description: "See the role-level map built across the full evidence set." },
  { key: "interview", label: "3. Interview", description: "Fill only the highest-value gaps left by the combined evidence." },
  { key: "handoff", label: "4. Handoff", description: "Prepare the transfer after critical gaps are resolved." },
];

const ANALYSIS_PHASES = ["Reading evidence", "Mapping work", "Recovering decisions", "Finding gaps"];
const SYNTHESIS_PHASES = [
  "Reading the full evidence set",
  "Consolidating duplicate work areas",
  "Mapping source support to role domains",
  "Finding contradictions and missing context",
];

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 12) {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((item) => {
      const value = key(item).toLowerCase().trim();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function mergeEvidenceResult(
  workspace: PersonalWorkspace,
  result: ReconstructionResult,
  text: string,
) {
  const previous = workspace.transition;
  const transition: Transition = {
    ...previous,
    summary: result.summary,
    sources: [...previous.sources, result.source],
    projects: mergeUnique(previous.projects, result.projects, (item) => item.name),
    risks: mergeUnique(previous.risks, result.risks, (item) => item.title, 10),
    gaps: mergeUnique(previous.gaps, result.gaps, (item) => item.question, 12),
  };

  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    transition,
    sourceBodies: { ...workspace.sourceBodies, [result.source.id]: text },
    evidenceCollectionComplete: false,
    evidenceCollectionCompletedAt: undefined,
    interviewGapStates: {},
    roleEvidence: undefined,
  } satisfies PersonalWorkspace;
}

function sourceLabel(source: SourceItem) {
  if (source.kind === "interview") return "Interview";
  if (source.kind === "ai-context") return "AI-recovered";
  if (source.kind === "github") return "GitHub";
  return source.provider;
}

function domainBadge(status: "Covered" | "Partial" | "Thin") {
  if (status === "Covered") return "bg-ok/10 text-ok";
  if (status === "Partial") return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}

export function EvidenceWorkspace() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [stage, setStage] = useState<Stage>("sources");
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste");
  const [showAdd, setShowAdd] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceProvider, setSourceProvider] = useState("Pasted evidence");
  const [analysisPhase, setAnalysisPhase] = useState(-1);
  const [synthesisPhase, setSynthesisPhase] = useState(-1);
  const [message, setMessage] = useState("");
  const [googleToken, setGoogleToken] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWorkspace(getCurrentWorkspace());
  }, []);

  const transition = workspace?.transition;
  const roleEvidence = workspace?.roleEvidence;
  const evidenceSources = useMemo(
    () => transition?.sources.filter((source) => source.kind !== "interview") ?? [],
    [transition],
  );
  const interviewSources = useMemo(
    () => transition?.sources.filter((source) => source.kind === "interview") ?? [],
    [transition],
  );
  const unreviewed = useMemo(
    () => evidenceSources.filter((source) => !workspace?.reviewedSourceIds.includes(source.id)),
    [evidenceSources, workspace],
  );
  const gapStates = workspace?.interviewGapStates ?? {};
  const criticalGaps = useMemo(
    () => transition ? blockingCriticalGaps(transition.gaps, gapStates) : [],
    [transition, gapStates],
  );
  const activeInterviewGaps = useMemo(
    () => transition ? rankedInterviewGaps(transition.gaps, transition.risks, gapStates) : [],
    [transition, gapStates],
  );
  const handoffOpenGaps = useMemo(
    () => transition?.gaps.filter((gap) => !isDismissedInterviewGap(gapStates[gap.question])) ?? [],
    [transition, gapStates],
  );

  const evidenceComplete = Boolean(
    workspace?.evidenceCollectionComplete &&
    roleEvidence &&
    evidenceSources.length,
  );
  const reconstructionReviewed = evidenceComplete && unreviewed.length === 0;
  const interviewUnlocked = reconstructionReviewed;
  const handoffUnlocked = interviewUnlocked && criticalGaps.length === 0;

  const stageAccess: Record<Stage, boolean> = {
    sources: true,
    map: evidenceSources.length > 0,
    interview: interviewUnlocked,
    handoff: handoffUnlocked,
  };

  const stageComplete: Record<Stage, boolean> = {
    sources: evidenceComplete,
    map: reconstructionReviewed,
    interview: interviewUnlocked && criticalGaps.length === 0 && (activeInterviewGaps.length === 0 || interviewSources.length > 0),
    handoff: false,
  };

  const recommended: Stage = !evidenceComplete
    ? "sources"
    : unreviewed.length
      ? "map"
      : criticalGaps.length
        ? "interview"
        : activeInterviewGaps.length && !interviewSources.length
          ? "interview"
          : "handoff";

  function persist(next: PersonalWorkspace) {
    setWorkspace(next);
    saveWorkspace(next);
  }

  function requestStage(next: Stage) {
    if (stageAccess[next]) {
      setStage(next);
      setMessage("");
      return;
    }
    if (next === "map") {
      setMessage("Add at least one real source before reviewing a reconstruction.");
    } else if (next === "interview") {
      setMessage(
        !evidenceComplete
          ? "Finish evidence collection so Understudy can synthesize the full set into a role-level evidence map first."
          : `Review the reconstruction first. ${unreviewed.length} source${unreviewed.length === 1 ? "" : "s"} still need verification.`,
      );
    } else {
      setMessage(
        criticalGaps.length
          ? `The handoff is not ready yet. ${criticalGaps.length} critical item${criticalGaps.length === 1 ? " still needs" : "s still need"} a real answer or follow-up.`
          : "Complete evidence review before opening the handoff.",
      );
    }
  }

  async function analyseSource(input: { title: string; text: string; provider: string; kind?: EvidenceKind }) {
    if (!workspace || input.text.trim().length < 20) return;
    setMessage("");
    setAnalysisPhase(0);
    const interval = window.setInterval(
      () => setAnalysisPhase((value) => Math.min(value + 1, ANALYSIS_PHASES.length - 1)),
      700,
    );
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
            title: input.title,
            text: input.text,
            provider: input.provider,
            kind: input.kind ?? "document",
          },
        }),
      });
      const payload = (await response.json()) as {
        result?: ReconstructionResult;
        usedModel?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not analyse this evidence.");

      const next = mergeEvidenceResult(workspace, payload.result, input.text);
      persist(next);
      setSourceTitle("");
      setSourceText("");
      setShowAdd(false);
      const count = next.transition.sources.filter((source) => source.kind !== "interview").length;
      setMessage(
        `${payload.usedModel ? "Gemini analysed" : "Understudy imported"} this source. You now have ${count} evidence source${count === 1 ? "" : "s"}. The role-level map will be rebuilt from all sources together when you finish collection.`,
      );
      setStage("sources");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence analysis failed.");
    } finally {
      window.clearInterval(interval);
      setAnalysisPhase(-1);
    }
  }

  async function readUpload(file?: File) {
    if (!file) return;
    setMessage("");
    try {
      const text = await extractFileText(file);
      setSourceTitle(file.name);
      setSourceText(text);
      setSourceProvider("Uploaded document");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Understudy could not read this file.");
    }
  }

  async function connectDrive() {
    setMessage("");
    try {
      let token = googleToken;
      if (!token) {
        const connected = await connectGoogleDrive();
        token = connected.accessToken;
        setGoogleToken(token);
        saveIdentity(connected.identity);
      }
      const picked = await pickGoogleDriveFile(token);
      if (!picked) return;
      const file = await readGoogleDriveFile(token, picked);
      setSourceTitle(file.title);
      setSourceText(file.text);
      setSourceProvider("Google Drive");
      setSourceMode("drive");
      setShowAdd(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Drive connection failed.");
    }
  }

  function verifySource(source: SourceItem) {
    if (!workspace) return;
    persist({
      ...workspace,
      updatedAt: new Date().toISOString(),
      reviewedSourceIds: [...new Set([...workspace.reviewedSourceIds, source.id])],
    });
  }

  function removeEvidenceSource(source: SourceItem) {
    if (!workspace) return;
    const confirmed = window.confirm(
      `Remove “${source.title}” from this handoff? Understudy will discard the current role synthesis and rebuild it from the remaining evidence.`,
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const sourceBodies = { ...workspace.sourceBodies };
    delete sourceBodies[source.id];
    const sources = workspace.transition.sources.filter((item) => item.id !== source.id);
    const remainingEvidence = sources.filter((item) => item.kind !== "interview");
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

    const transition: Transition = {
      ...workspace.transition,
      sources,
      summary: remainingEvidence.length
        ? `Evidence changed. ${remainingEvidence.length} source${remainingEvidence.length === 1 ? " remains" : "s remain"}. Finish evidence collection again so Understudy can rebuild the role from the updated set.`
        : "No evidence remains in this handoff. Add real work artifacts before reconstruction can continue.",
      projects: [],
      risks: [],
      gaps: [],
      metrics: workspace.transition.metrics.map((metric) => ({
        ...metric,
        value: 0,
        note: metric.label === "Successor review"
          ? successorReview ? "Review reopened after evidence changed" : "Not reviewed"
          : "Rebuild required after evidence changed",
      })),
      readiness: 0,
      status: "Needs attention",
    };

    persist({
      ...workspace,
      updatedAt: now,
      transition,
      sourceBodies,
      reviewedSourceIds: workspace.reviewedSourceIds.filter((id) => id !== source.id),
      evidenceCollectionComplete: false,
      evidenceCollectionCompletedAt: undefined,
      interviewGapStates: {},
      roleEvidence: undefined,
      successorReview,
    });
    setStage("sources");
    setShowAdd(remainingEvidence.length === 0);
    setMessage(
      remainingEvidence.length
        ? `Removed “${source.title}”. The previous role synthesis is no longer valid; finish evidence collection again to rebuild it from the remaining ${remainingEvidence.length} source${remainingEvidence.length === 1 ? "" : "s"}.`
        : `Removed “${source.title}”. This handoff now has no evidence, so add a source before continuing.`,
    );
  }

  async function finishEvidenceCollection() {
    if (!workspace || !evidenceSources.length || synthesisPhase >= 0) {
      if (!evidenceSources.length) setMessage("Add at least one real source before finishing evidence collection.");
      return;
    }

    const synthesisSources = evidenceSources
      .map((source) => ({
        id: source.id,
        title: source.title,
        kind: source.kind,
        provider: source.provider,
        confidence: source.confidence,
        text: workspace.sourceBodies[source.id] ?? "",
      }))
      .filter((source) => source.text.trim());

    if (!synthesisSources.length) {
      setMessage("Understudy could not find the stored source bodies needed for role-level synthesis.");
      return;
    }

    setMessage("");
    setSynthesisPhase(0);
    const interval = window.setInterval(
      () => setSynthesisPhase((value) => Math.min(value + 1, SYNTHESIS_PHASES.length - 1)),
      850,
    );

    try {
      const response = await fetch("/api/synthesize-role", {
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
          sources: synthesisSources,
          current: {
            summary: workspace.transition.summary,
            projects: workspace.transition.projects,
            risks: workspace.transition.risks,
            gaps: workspace.transition.gaps,
          },
        }),
      });
      const payload = (await response.json()) as {
        result?: WholeRoleSynthesisResult;
        usedModel?: boolean;
        truncated?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not synthesize the evidence set.");

      const now = new Date().toISOString();
      const result = payload.result;
      const next: PersonalWorkspace = {
        ...workspace,
        updatedAt: now,
        roleEvidence: result.evidenceModel,
        evidenceCollectionComplete: true,
        evidenceCollectionCompletedAt: now,
        transition: {
          ...workspace.transition,
          summary: result.summary,
          projects: result.projects,
          risks: result.risks,
          gaps: result.gaps,
          metrics: result.metrics,
          readiness: result.readiness,
          status: result.readiness >= 80 ? "Ready for review" : result.readiness >= 55 ? "In progress" : "Needs attention",
        },
      };
      persist(next);
      setStage("map");
      setMessage(
        payload.usedModel
          ? `Understudy synthesized ${synthesisSources.length} sources as one role. It found ${result.evidenceModel.domains.length} observed work domain${result.evidenceModel.domains.length === 1 ? "" : "s"}. Coverage is now based on domain support and provenance, not document count.${payload.truncated ? " Very large source bodies were compacted for this synthesis pass." : ""}`
          : "Whole-role Gemini synthesis was unavailable, so Understudy built a conservative evidence index. No role-completeness claim was made; review the map carefully.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Whole-role synthesis failed.");
    } finally {
      window.clearInterval(interval);
      setSynthesisPhase(-1);
    }
  }

  function reopenEvidenceCollection() {
    if (!workspace) return;
    persist({
      ...workspace,
      updatedAt: new Date().toISOString(),
      evidenceCollectionComplete: false,
      evidenceCollectionCompletedAt: undefined,
    });
    setStage("sources");
    setShowAdd(true);
    setMessage("Evidence collection reopened. Add anything you missed, then Understudy will resynthesize the entire role from the updated set.");
  }

  const handoff = useMemo(() => {
    if (!transition) return "";
    return `# ${transition.role} handoff\n\n**From:** ${transition.person}\n**To:** ${transition.successor}\n**Target:** ${transition.targetDate}\n\n## Role overview\n${transition.summary}\n\n## Active work\n${transition.projects.map((project) => `- **${project.name}** — ${project.state}; ${project.ownership}`).join("\n") || "- No active work confidently reconstructed yet."}\n\n## Continuity risks\n${transition.risks.map((risk) => `- **${risk.title}** — ${risk.detail}`).join("\n") || "- No material continuity risks identified from current evidence."}\n\n## Open questions\n${handoffOpenGaps.map((gap) => `- ${gap.question}`).join("\n") || "- No open questions from current evidence."}\n\n## Evidence\n${transition.sources.map((source) => `- ${source.title} (${source.provider})`).join("\n")}`;
  }, [transition, handoffOpenGaps]);

  if (!workspace || !transition) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No personal transition yet.</h1>
        <p className="mt-2 text-sm text-muted">Create a transition first, then build its evidence set.</p>
        <button onClick={() => window.location.assign("/")} className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Start onboarding</button>
      </div>
    );
  }

  const coveredDomains = roleEvidence?.domains.filter((domain) => domain.status === "Covered").length ?? 0;
  const partialDomains = roleEvidence?.domains.filter((domain) => domain.status === "Partial").length ?? 0;
  const thinDomains = roleEvidence?.domains.filter((domain) => domain.status === "Thin").length ?? 0;

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            <span className="rounded-md border border-border bg-card px-2 py-1">{transition.type}</span>
            <span>Target {transition.targetDate}</span>
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">{transition.person} · {transition.role}</h1>
          <p className="mt-1 text-sm text-muted">Preparing {transition.successor} to continue the work without losing decision context.</p>
        </div>
        <div className="w-full rounded-xl border border-border bg-card p-4 lg:w-72">
          <div className="flex items-center justify-between text-xs"><span className="text-subtle">Transfer readiness</span><span className="font-mono text-muted">{transition.readiness}%</span></div>
          <div className="mt-2"><Bar value={transition.readiness} /></div>
          <p className="mt-2 text-xs leading-5 text-faint">This is transfer readiness, not an evidence-completeness score. Successor review still counts only when a real review happens.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-2 md:grid-cols-4">
        {STAGES.map((item) => {
          const accessible = stageAccess[item.key];
          const complete = stageComplete[item.key];
          const active = stage === item.key;
          const status = active ? "Current" : complete ? "Complete" : !accessible ? "Locked" : item.key === recommended ? "Next" : "Available";
          return (
            <button
              key={item.key}
              onClick={() => requestStage(item.key)}
              aria-disabled={!accessible}
              className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-border-strong bg-card-hover" : accessible ? "border-border bg-card hover:bg-card-hover" : "cursor-not-allowed border-border bg-card/45 opacity-55"}`}
            >
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{item.label}</span>{complete && <IconCheck className="h-4 w-4 text-ok" />}</div>
              <p className="mt-1.5 text-xs leading-5 text-subtle">{item.description}</p>
              <p className="mt-2 text-[11px] font-medium text-faint">{status}</p>
            </button>
          );
        })}
      </div>

      {message && <div className="mb-5 rounded-lg border border-border bg-card px-4 py-3 text-sm leading-5 text-muted">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main>
          {stage === "sources" && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><h2 className="text-lg font-medium">Build the evidence set</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">Add the artifacts a successor would inherit. Understudy will not treat document count as completeness; when you finish, it synthesizes all sources together into observed role domains.</p></div>
                <button onClick={() => setShowAdd((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconUpload /> Add evidence</button>
              </div>

              {showAdd && (
                <div className="mb-5 rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap gap-2">
                    {(["paste", "upload", "drive"] as SourceMode[]).map((item) => (
                      <button key={item} onClick={() => setSourceMode(item)} className={`rounded-lg px-3 py-2 text-xs ${sourceMode === item ? "bg-foreground text-background" : "border border-border bg-background text-muted"}`}>{item === "paste" ? "Paste text" : item === "upload" ? "Upload file" : "Google Drive"}</button>
                    ))}
                  </div>
                  {sourceMode === "paste" && <><input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title" className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint" /><textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={8} placeholder="Paste a PRD, roadmap, runbook, project note, meeting summary, or other work evidence…" className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none placeholder:text-faint" /></>}
                  {sourceMode === "upload" && <><button onClick={() => fileInput.current?.click()} className="mt-4 flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-background"><IconFile className="text-muted" /><span className="mt-2 text-sm text-muted">Choose {SUPPORTED_UPLOAD_LABEL}</span></button><input ref={fileInput} type="file" className="hidden" accept={SUPPORTED_UPLOAD_ACCEPT} onChange={(event) => void readUpload(event.target.files?.[0])} />{sourceTitle && <p className="mt-2 text-xs text-muted">Selected: {sourceTitle}</p>}</>}
                  {sourceMode === "drive" && <div className="mt-4 rounded-lg border border-border bg-background p-5 text-center"><p className="text-sm font-medium">Choose a work file from Google Drive</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-subtle">Understudy only receives the file you choose. After analysing it, you can immediately add another source.</p><button onClick={() => void connectDrive()} className="mt-3 rounded-lg border border-border-strong bg-card px-3 py-2 text-sm text-muted hover:bg-card-hover">Connect Google & choose file</button>{sourceProvider === "Google Drive" && sourceTitle && <p className="mt-2 text-xs text-ok">Selected: {sourceTitle}</p>}</div>}
                  {analysisPhase >= 0 ? <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3">{ANALYSIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-2 text-xs ${index <= analysisPhase ? "text-muted" : "text-faint"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < analysisPhase ? "bg-ok" : index === analysisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div> : <div className="mt-4 flex justify-end"><button disabled={!sourceTitle.trim() || sourceText.trim().length < 20} onClick={() => void analyseSource({ title: sourceTitle, text: sourceText, provider: sourceProvider })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-35"><IconSpark /> Analyse and add</button></div>}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {evidenceSources.length ? evidenceSources.map((source, index) => {
                  const verified = workspace.reviewedSourceIds.includes(source.id);
                  return <div key={source.id} className={`grid gap-3 p-4 sm:grid-cols-[40px_minmax(0,1fr)_190px] sm:items-center ${index ? "border-t border-border" : ""}`}><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="text-muted" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{source.title}</p><span className={`rounded px-1.5 py-0.5 text-[11px] ${verified ? "bg-ok/10 text-ok" : "bg-warning/10 text-warning"}`}>{verified ? "Reviewed" : "Needs review"}</span></div><p className="mt-1 text-xs leading-5 text-subtle">{sourceLabel(source)} · {source.extracted.join(" · ")}</p></div><div className="flex items-center gap-2 sm:justify-end"><button onClick={() => requestStage("map")} className="rounded-md border border-border px-2 py-2 text-xs text-muted hover:bg-card-hover">View findings</button><button onClick={() => removeEvidenceSource(source)} className="rounded-md border border-danger/20 px-2 py-2 text-xs text-danger hover:bg-danger/10">Remove</button></div></div>;
                }) : <div className="p-10 text-center"><IconFile className="mx-auto text-faint" /><p className="mt-3 text-sm font-medium">No evidence yet</p><p className="mt-1 text-xs text-subtle">Start with a real artifact. Understudy will not invent a role model without evidence.</p></div>}
              </div>

              {synthesisPhase >= 0 && <div className="mt-5 space-y-2 rounded-xl border border-border bg-card p-4">{SYNTHESIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-2 text-sm ${index <= synthesisPhase ? "text-muted" : "text-faint"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < synthesisPhase ? "bg-ok" : index === synthesisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div>}

              {evidenceSources.length > 0 && synthesisPhase < 0 && <div className="mt-5 rounded-xl border border-border-strong bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Do you have more evidence for this role?</p><p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">You have {evidenceSources.length} source{evidenceSources.length === 1 ? "" : "s"}. They may describe one project or many unrelated months of work. Finishing collection triggers a fresh cross-source synthesis; it does not claim the role is 100% complete.</p></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setShowAdd(true)} className="rounded-lg border border-border-strong px-3 py-2 text-sm text-muted hover:bg-card-hover">Add another</button><button onClick={() => void finishEvidenceCollection()} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">That&apos;s all I have</button></div></div></div>}
            </section>
          )}

          {stage === "map" && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-medium">Reconstruction</h2><p className="mt-1 text-sm leading-6 text-subtle">The map below is synthesized across the whole evidence set. “Covered” means corroborated by the supplied evidence, not proof that no work is missing.</p></div>{evidenceComplete && <button onClick={reopenEvidenceCollection} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Add more evidence</button>}</div>
              {!evidenceComplete && <div className="mb-4 rounded-xl border border-warning/25 bg-warning/5 p-4 text-sm leading-6 text-muted">This is still a source-by-source preview. Finish evidence collection to generate a role-level synthesis before the interview.</div>}

              {roleEvidence && <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium">Observed role domains</p><p className="mt-1 max-w-3xl text-sm leading-6 text-subtle">{roleEvidence.overview}</p></div><span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-subtle">{roleEvidence.domains.length} domains · {roleEvidence.sourceCount} sources</span></div><div className="mt-4 overflow-hidden rounded-lg border border-border">{roleEvidence.domains.length ? roleEvidence.domains.map((domain, index) => <div key={domain.id} className={`${index ? "border-t border-border" : ""} p-4`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{domain.name}</p><span className={`rounded px-1.5 py-0.5 text-[11px] ${domainBadge(domain.status)}`}>{domain.status}</span><span className="text-xs text-faint">{domain.type}</span></div><p className="mt-1 text-sm leading-6 text-subtle">{domain.description}</p></div><span className="text-xs text-subtle">{domain.sourceIds.length} supporting source{domain.sourceIds.length === 1 ? "" : "s"}</span></div>{domain.missing.length > 0 && <div className="mt-3 rounded-lg bg-background px-3 py-2"><p className="text-xs font-medium text-muted">Still missing here</p><p className="mt-1 text-xs leading-5 text-subtle">{domain.missing.join(" · ")}</p></div>}</div>) : <div className="p-6 text-sm text-subtle">No stable role domains could be established from the current evidence.</div>}</div></div>

                {(roleEvidence.missingAreas.length > 0 || roleEvidence.contradictions.length > 0) && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-medium">Likely missing areas</h3><p className="mt-1 text-xs leading-5 text-faint">These are hypotheses, not claims that the work definitely existed.</p><div className="mt-3 space-y-2">{roleEvidence.missingAreas.length ? roleEvidence.missingAreas.map((area) => <p key={area} className="text-sm leading-5 text-subtle">• {area}</p>) : <p className="text-sm text-subtle">No additional area was suggested.</p>}</div></div><div className="rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-medium">Cross-source contradictions</h3><div className="mt-3 space-y-2">{roleEvidence.contradictions.length ? roleEvidence.contradictions.map((item) => <p key={item.claim} className="text-sm leading-5 text-subtle">• {item.claim} <span className="text-faint">({item.sourceIds.length} sources)</span></p>) : <p className="text-sm text-subtle">No material contradiction was detected.</p>}</div></div></div>}
              </div>}

              <div className="mt-5 space-y-5">
                <div className="overflow-hidden rounded-xl border border-border bg-card">{transition.projects.length ? transition.projects.map((project, index) => <div key={project.name} className={`${index ? "border-t border-border" : ""} p-4`}><p className="text-sm font-medium">{project.name}</p><p className="mt-1 text-xs text-subtle">{project.state} · {project.ownership}</p></div>) : <div className="p-8 text-center text-sm text-subtle">No active work confidently reconstructed yet.</div>}</div>
                <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconAlert className="text-warning" /><h3 className="text-sm font-medium">Continuity risks</h3></div><div className="mt-3 space-y-3">{transition.risks.length ? transition.risks.map((risk) => <div key={risk.title}><p className="text-sm font-medium text-muted">{risk.title}</p><p className="mt-1 text-xs leading-5 text-subtle">{risk.detail}</p></div>) : <p className="text-xs text-subtle">No risks identified yet.</p>}</div></div><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconSpark className="text-muted" /><h3 className="text-sm font-medium">What the full evidence set cannot answer</h3></div><div className="mt-3 space-y-3">{handoffOpenGaps.length ? handoffOpenGaps.map((gap) => <div key={gap.question}><p className="text-xs text-subtle">{gap.topic} · {gap.priority}</p><p className="mt-1 text-sm leading-5 text-muted">{gap.question}</p></div>) : <p className="text-xs text-subtle">No open questions from the current evidence.</p>}</div></div></div>
                {evidenceComplete && unreviewed.length > 0 && <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm font-medium">Verify the source interpretations</p><p className="mt-1 text-xs leading-5 text-subtle">{unreviewed.length} source{unreviewed.length === 1 ? "" : "s"} still need review before Understudy starts asking interview questions.</p><div className="mt-3 flex flex-wrap gap-2">{unreviewed.map((source) => <button key={source.id} onClick={() => verifySource(source)} className="rounded-lg border border-border-strong px-3 py-2 text-xs text-muted hover:bg-card-hover">Verify {source.title}</button>)}</div></div>}
                {reconstructionReviewed && <button onClick={() => requestStage("interview")} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Continue to missing context <IconChevronRight /></button>}
              </div>
            </section>
          )}

          {stage === "interview" && <AdaptiveInterview workspace={workspace} onWorkspaceChange={persist} onMessage={setMessage} />}

          {stage === "handoff" && <section><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-lg font-medium">Handoff draft</h2><p className="mt-1 text-sm text-subtle">Critical knowledge gaps are clear. Lower-priority open context stays visible instead of blocking the transfer.</p></div><button onClick={async () => { await navigator.clipboard.writeText(handoff); setMessage("Handoff copied as Markdown."); }} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover">Copy Markdown</button></div><div className="rounded-xl border border-border bg-card p-6"><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-muted">{handoff}</pre></div></section>}
        </main>

        <aside>
          <div className="sticky top-6 space-y-4">
            <div className="rounded-xl border border-border-strong bg-card p-4">
              <p className="text-sm font-medium">Next checkpoint</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {!evidenceSources.length
                  ? "Add the first real artifact for this role."
                  : !evidenceComplete
                    ? `You have ${evidenceSources.length} source${evidenceSources.length === 1 ? "" : "s"}. Add anything else you have, then finish collection to synthesize them as one role.`
                    : unreviewed.length
                      ? `Role synthesis is ready. Review ${unreviewed.length} source${unreviewed.length === 1 ? "" : "s"} before the interview.`
                      : criticalGaps.length
                        ? `${criticalGaps.length} critical knowledge item${criticalGaps.length === 1 ? " remains" : "s remain"}. Work through the short interview focus set or assign the items for follow-up.`
                        : activeInterviewGaps.length && !interviewSources.length
                          ? `Critical gaps are clear. There are ${Math.min(3, activeInterviewGaps.length)} high-value interview question${Math.min(3, activeInterviewGaps.length) === 1 ? "" : "s"} worth answering, but Handoff is already available.`
                          : "Critical gaps are clear. The handoff can now be prepared."
                }
              </p>
              <button onClick={() => requestStage(recommended)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background">Go to next step <IconChevronRight /></button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between"><p className="text-sm font-medium">Evidence set</p><span className="text-xs text-subtle">{evidenceSources.length} source{evidenceSources.length === 1 ? "" : "s"}</span></div>
              <div className="mt-3 space-y-2 text-xs text-subtle"><div className="flex justify-between"><span>Collection</span><span>{evidenceComplete ? "Synthesized" : "Open"}</span></div><div className="flex justify-between"><span>Reviewed</span><span>{evidenceSources.length - unreviewed.length}/{evidenceSources.length}</span></div><div className="flex justify-between"><span>Observed domains</span><span>{roleEvidence?.domains.length ?? "—"}</span></div><div className="flex justify-between"><span>Critical gaps</span><span>{criticalGaps.length}</span></div></div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">Role evidence map</p><span className="text-xs text-subtle">not completeness</span></div>{roleEvidence ? <><div className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><span className="text-subtle">Covered</span><span className="font-medium text-ok">{coveredDomains}</span></div><div className="flex justify-between"><span className="text-subtle">Partial</span><span className="font-medium text-warning">{partialDomains}</span></div><div className="flex justify-between"><span className="text-subtle">Thin</span><span className="font-medium text-danger">{thinDomains}</span></div><div className="flex justify-between"><span className="text-subtle">Likely missing areas</span><span className="font-medium text-muted">{roleEvidence.missingAreas.length}</span></div></div><p className="mt-3 text-xs leading-5 text-faint">These statuses describe support for observed work domains. Understudy does not claim that an unseen part of the role cannot exist.</p></> : <p className="mt-3 text-xs leading-5 text-subtle">Finish evidence collection to build the cross-source role map.</p>}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
