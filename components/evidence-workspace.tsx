"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
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
  { key: "sources", label: "1. Evidence", description: "Build the evidence set before treating any one document as the role." },
  { key: "map", label: "2. Reconstruction", description: "Review what the combined evidence currently supports." },
  { key: "interview", label: "3. Interview", description: "Fill only the highest-value gaps left by the evidence." },
  { key: "handoff", label: "4. Handoff", description: "Prepare the transfer after critical gaps are resolved." },
];

const ANALYSIS_PHASES = ["Reading evidence", "Mapping work", "Recovering decisions", "Finding gaps"];

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

function mergeEvidenceResult(
  workspace: PersonalWorkspace,
  result: ReconstructionResult,
  text: string,
) {
  const previous = workspace.transition;
  const projects = mergeUnique(previous.projects, result.projects, (item) => item.name);
  const risks = mergeUnique(previous.risks, result.risks, (item) => item.title, 10);
  const gaps = mergeUnique(previous.gaps, result.gaps, (item) => item.question, 12);
  const priorEvidenceCount = previous.sources.filter((source) => source.kind !== "interview").length;

  const metrics = result.metrics.map((metric) => {
    if (metric.label === "Successor review") {
      return previous.metrics.find((item) => item.label === metric.label) ?? metric;
    }
    const old = previous.metrics.find((item) => item.label === metric.label);
    if (!old || priorEvidenceCount === 0) return metric;
    return {
      ...metric,
      value: Math.round((old.value * priorEvidenceCount + metric.value) / (priorEvidenceCount + 1)),
    };
  });
  const readiness = calculateReadiness(metrics);

  const transition: Transition = {
    ...previous,
    summary: result.summary,
    sources: [...previous.sources, result.source],
    projects,
    risks,
    gaps,
    metrics,
    readiness,
    status: readiness >= 80 ? "Ready for review" : readiness >= 55 ? "In progress" : "Needs attention",
  };

  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    transition,
    sourceBodies: { ...workspace.sourceBodies, [result.source.id]: text },
    evidenceCollectionComplete: false,
    evidenceCollectionCompletedAt: undefined,
    interviewGapStates: {},
  } satisfies PersonalWorkspace;
}

function sourceLabel(source: SourceItem) {
  if (source.kind === "interview") return "Interview";
  if (source.kind === "ai-context") return "AI-recovered";
  if (source.kind === "github") return "GitHub";
  return source.provider;
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
  const [message, setMessage] = useState("");
  const [googleToken, setGoogleToken] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWorkspace(getCurrentWorkspace());
  }, []);

  const transition = workspace?.transition;
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

  const evidenceComplete = Boolean(workspace?.evidenceCollectionComplete && evidenceSources.length);
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
          ? "Finish evidence collection first. Understudy should not interview you while it is still missing documents you already have."
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
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Could not analyse this evidence.");
      }

      const next = mergeEvidenceResult(workspace, payload.result, input.text);
      persist(next);
      setSourceTitle("");
      setSourceText("");
      setShowAdd(false);
      const count = next.transition.sources.filter((source) => source.kind !== "interview").length;
      setMessage(
        `${payload.usedModel ? "Gemini analysed" : "Understudy imported"} this source. You now have ${count} evidence source${count === 1 ? "" : "s"}. Add anything else you have, or explicitly finish evidence collection when this set is representative of the role.`,
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
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (![".txt", ".md", ".json", ".csv"].includes(extension)) {
      setMessage("This build currently parses TXT, Markdown, JSON, CSV and Google Docs. PDF/DOCX comes later.");
      return;
    }
    setSourceTitle(file.name);
    setSourceText((await file.text()).slice(0, 60_000));
    setSourceProvider("Uploaded document");
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

  function finishEvidenceCollection() {
    if (!workspace || !evidenceSources.length) {
      setMessage("Add at least one real source before finishing evidence collection.");
      return;
    }
    const now = new Date().toISOString();
    persist({
      ...workspace,
      updatedAt: now,
      evidenceCollectionComplete: true,
      evidenceCollectionCompletedAt: now,
    });
    setMessage(
      `Evidence collection marked complete with ${evidenceSources.length} source${evidenceSources.length === 1 ? "" : "s"}. Next, review what Understudy reconstructed. You can reopen evidence collection at any time.`,
    );
    setStage("map");
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
    setMessage("Evidence collection reopened. Later stages are paused until you finish collecting again.");
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
          <p className="mt-2 text-xs leading-5 text-faint">Only earned product states count. Successor review remains 0 until a real review happens.</p>
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
                <div><h2 className="text-lg font-medium">Build the evidence set</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">A PRD can explain one project. It cannot prove that it represents the whole role. Add the documents and context a successor would actually inherit.</p></div>
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
                  {sourceMode === "upload" && <><button onClick={() => fileInput.current?.click()} className="mt-4 flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-background"><IconFile className="text-muted" /><span className="mt-2 text-sm text-muted">Choose TXT, Markdown, JSON, or CSV</span></button><input ref={fileInput} type="file" className="hidden" accept=".txt,.md,.json,.csv" onChange={(event) => void readUpload(event.target.files?.[0])} />{sourceTitle && <p className="mt-2 text-xs text-muted">Selected: {sourceTitle}</p>}</>}
                  {sourceMode === "drive" && <div className="mt-4 rounded-lg border border-border bg-background p-5 text-center"><p className="text-sm font-medium">Choose a work file from Google Drive</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-subtle">Understudy only receives the file you choose. After analysing it, you can immediately add another source.</p><button onClick={() => void connectDrive()} className="mt-3 rounded-lg border border-border-strong bg-card px-3 py-2 text-sm text-muted hover:bg-card-hover">Connect Google & choose file</button>{sourceProvider === "Google Drive" && sourceTitle && <p className="mt-2 text-xs text-ok">Selected: {sourceTitle}</p>}</div>}
                  {analysisPhase >= 0 ? <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3">{ANALYSIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-2 text-xs ${index <= analysisPhase ? "text-muted" : "text-faint"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < analysisPhase ? "bg-ok" : index === analysisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div> : <div className="mt-4 flex justify-end"><button disabled={!sourceTitle.trim() || sourceText.trim().length < 20} onClick={() => void analyseSource({ title: sourceTitle, text: sourceText, provider: sourceProvider })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-35"><IconSpark /> Analyse and add</button></div>}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {evidenceSources.length ? evidenceSources.map((source, index) => {
                  const verified = workspace.reviewedSourceIds.includes(source.id);
                  return <div key={source.id} className={`grid gap-3 p-4 sm:grid-cols-[40px_minmax(0,1fr)_130px] sm:items-center ${index ? "border-t border-border" : ""}`}><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="text-muted" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{source.title}</p><span className={`rounded px-1.5 py-0.5 text-[11px] ${verified ? "bg-ok/10 text-ok" : "bg-warning/10 text-warning"}`}>{verified ? "Reviewed" : "Needs review"}</span></div><p className="mt-1 text-xs leading-5 text-subtle">{sourceLabel(source)} · {source.extracted.join(" · ")}</p></div><button onClick={() => requestStage("map")} className="rounded-md border border-border px-2 py-2 text-xs text-muted hover:bg-card-hover">View findings</button></div>;
                }) : <div className="p-10 text-center"><IconFile className="mx-auto text-faint" /><p className="mt-3 text-sm font-medium">No evidence yet</p><p className="mt-1 text-xs text-subtle">Start with a real artifact. Understudy will not invent a role model without evidence.</p></div>}
              </div>

              {evidenceSources.length > 0 && <div className="mt-5 rounded-xl border border-border-strong bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Do you have more evidence for this role?</p><p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">You have {evidenceSources.length} source{evidenceSources.length === 1 ? "" : "s"}. Add roadmaps, notes, runbooks, specs, or other artifacts before asking the person to explain things the documents already know.</p></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setShowAdd(true)} className="rounded-lg border border-border-strong px-3 py-2 text-sm text-muted hover:bg-card-hover">Add another</button><button onClick={finishEvidenceCollection} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">That&apos;s all I have</button></div></div></div>}
            </section>
          )}

          {stage === "map" && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-medium">Reconstruction</h2><p className="mt-1 text-sm leading-6 text-subtle">Review what the evidence supports. This is still a working model, not generated truth.</p></div>{evidenceComplete && <button onClick={reopenEvidenceCollection} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Add more evidence</button>}</div>
              {!evidenceComplete && <div className="mb-4 rounded-xl border border-warning/25 bg-warning/5 p-4 text-sm leading-6 text-muted">You are previewing an incomplete reconstruction. Return to Evidence and choose <strong className="text-foreground">That&apos;s all I have</strong> when the current source set is representative of the role.</div>}
              <div className="space-y-5">
                <div className="overflow-hidden rounded-xl border border-border bg-card">{transition.projects.length ? transition.projects.map((project, index) => <div key={project.name} className={`${index ? "border-t border-border" : ""} p-4`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{project.name}</p><p className="mt-1 text-xs text-subtle">{project.state} · {project.ownership}</p></div><span className="font-mono text-xs text-muted">{project.evidence}% evidence</span></div><div className="mt-3"><Bar value={project.evidence} /></div></div>) : <div className="p-8 text-center text-sm text-subtle">No work areas reconstructed yet.</div>}</div>
                <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconAlert className="text-warning" /><h3 className="text-sm font-medium">Continuity risks</h3></div><div className="mt-3 space-y-3">{transition.risks.length ? transition.risks.map((risk) => <div key={risk.title}><p className="text-sm font-medium text-muted">{risk.title}</p><p className="mt-1 text-xs leading-5 text-subtle">{risk.detail}</p></div>) : <p className="text-xs text-subtle">No risks identified yet.</p>}</div></div><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconSpark className="text-muted" /><h3 className="text-sm font-medium">What the evidence cannot answer</h3></div><div className="mt-3 space-y-3">{handoffOpenGaps.length ? handoffOpenGaps.map((gap) => <div key={gap.question}><p className="text-xs text-subtle">{gap.topic} · {gap.priority}</p><p className="mt-1 text-sm leading-5 text-muted">{gap.question}</p></div>) : <p className="text-xs text-subtle">No open questions from the current evidence.</p>}</div></div></div>
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
                    ? `You have ${evidenceSources.length} source${evidenceSources.length === 1 ? "" : "s"}. Add anything else you have, then explicitly finish evidence collection.`
                    : unreviewed.length
                      ? `Evidence collection is complete. Review ${unreviewed.length} source${unreviewed.length === 1 ? "" : "s"} before the interview.`
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
              <div className="mt-3 space-y-2 text-xs text-subtle"><div className="flex justify-between"><span>Collection</span><span>{evidenceComplete ? "Finished" : "Open"}</span></div><div className="flex justify-between"><span>Reviewed</span><span>{evidenceSources.length - unreviewed.length}/{evidenceSources.length}</span></div><div className="flex justify-between"><span>Critical gaps</span><span>{criticalGaps.length}</span></div><div className="flex justify-between"><span>Interview evidence</span><span>{interviewSources.length}</span></div></div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4"><p className="text-sm font-medium">Coverage</p><div className="mt-4 space-y-3">{transition.metrics.map((metric) => <div key={metric.label}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-subtle">{metric.label}</span><span className="font-mono text-muted">{metric.value}%</span></div><Bar value={metric.value} /></div>)}</div></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
