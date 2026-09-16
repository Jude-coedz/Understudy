"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EvidenceKind, SourceItem, Transition } from "@/data/v2-demo";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import type { WholeRoleSynthesisResult } from "@/lib/role-evidence";
import {
  getCurrentWorkspace,
  saveIdentity,
  saveWorkspace,
  type PersonalWorkspace,
} from "@/lib/personal-workspace";
import { extractFileText, SUPPORTED_UPLOAD_ACCEPT, SUPPORTED_UPLOAD_LABEL } from "@/lib/file-extraction";
import { connectGoogleDrive, pickGoogleDriveFile, readGoogleDriveFile } from "@/lib/google-drive";
import { blockingCriticalGaps, isDismissedInterviewGap } from "@/lib/interview-priority";
import { SUCCESSOR_REVIEW_CHECKS } from "@/lib/successor-review";
import { domainsForSource } from "@/lib/source-provenance";
import { AdaptiveInterview } from "./adaptive-interview";
import { CloudAccountControl } from "./cloud-account-control";
import { SourcePreviewDialog } from "./source-preview-dialog";
import { IconCheck, IconChevronRight, IconFile, IconSpark, IconUpload } from "./icons";

type Stage = "sources" | "map" | "interview" | "handoff";
type SourceMode = "upload" | "paste" | "drive";
type PendingEvidence = { id: string; title: string; text: string; provider: string; kind?: EvidenceKind };
type ReadingFiles = { current: number; total: number; name: string } | null;
type AnalysisProgress = { current: number; total: number; name: string; phase: number } | null;

const STAGES: Array<{ key: Stage; plain: string; product: string }> = [
  { key: "sources", plain: "Collect", product: "Evidence" },
  { key: "map", plain: "Understand", product: "Reconstruction" },
  { key: "interview", plain: "Fill the gaps", product: "Interview" },
  { key: "handoff", plain: "Hand over", product: "Verification" },
];

const SOURCE_ANALYSIS_PHASES = [
  "Reading the artifact",
  "Finding work, decisions, and dependencies",
  "Separating evidence from assumptions",
  "Preparing it for the role map",
];

const SYNTHESIS_PHASES = [
  "Reading the full evidence set",
  "Connecting related work across files",
  "Checking support and contradictions",
  "Finding only the gaps a human still needs to answer",
];

function stageIndex(stage: Stage) {
  return STAGES.findIndex((item) => item.key === stage);
}

function isClarification(source: SourceItem) {
  return source.kind === "interview" && source.provider === "Source clarification";
}

function roleSourcesFor(workspace: PersonalWorkspace) {
  return workspace.transition.sources.filter((source) => source.kind !== "interview" || isClarification(source));
}

function originalSourcesFor(workspace: PersonalWorkspace) {
  return workspace.transition.sources.filter((source) => source.kind !== "interview");
}

function reconstructionReviewed(workspace: PersonalWorkspace) {
  const sources = roleSourcesFor(workspace);
  return Boolean(sources.length && sources.every((source) => workspace.reviewedSourceIds.includes(source.id)));
}

function startingStage(workspace: PersonalWorkspace): Stage {
  if (!workspace.evidenceCollectionComplete || !workspace.roleEvidence) return "sources";
  if (!reconstructionReviewed(workspace)) return "map";
  if (!workspace.interviewCompletedAt) return "interview";
  return "handoff";
}

function resetSuccessorReview(workspace: PersonalWorkspace) {
  return workspace.successorReview
    ? {
        ...workspace.successorReview,
        status: "pending" as const,
        acceptedAt: undefined,
        updatedAt: new Date().toISOString(),
        checks: { roleScope: false, activeWork: false, ownership: false, risks: false, openQuestions: false },
      }
    : undefined;
}

function evidenceLabel(source: SourceItem) {
  if (isClarification(source)) return "Self-reported clarification";
  if (source.kind === "github") return "GitHub";
  if (source.kind === "ai-context") return "AI-recovered";
  return source.provider;
}

function assignedOwnership(value: string) {
  return !/unassigned|unknown|unclear|not assigned|tbd/i.test(value);
}

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 12) {
  const seen = new Set<string>();
  return [...incoming, ...existing].filter((item) => {
    const value = key(item).trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

function appendEvidenceResult(workspace: PersonalWorkspace, result: ReconstructionResult, text: string) {
  const previous = workspace.transition;
  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    transition: {
      ...previous,
      summary: result.summary || previous.summary,
      sources: [...previous.sources, result.source],
      projects: mergeUnique(previous.projects, result.projects, (item) => item.name),
      risks: mergeUnique(previous.risks, result.risks, (item) => item.title, 10),
      gaps: mergeUnique(previous.gaps, result.gaps, (item) => item.question, 12),
    },
    sourceBodies: { ...workspace.sourceBodies, [result.source.id]: text },
    evidenceCollectionComplete: false,
    evidenceCollectionCompletedAt: undefined,
    reviewedSourceIds: [],
    roleEvidence: undefined,
    interviewGapStates: {},
    interviewCompletedAt: undefined,
    successorReview: resetSuccessorReview(workspace),
  } satisfies PersonalWorkspace;
}

export function GuidedWorkspace() {
  const reducedMotion = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [stage, setStage] = useState<Stage>("sources");
  const [sourceMode, setSourceMode] = useState<SourceMode>("upload");
  const [adding, setAdding] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceProvider, setSourceProvider] = useState("Pasted evidence");
  const [queued, setQueued] = useState<PendingEvidence[]>([]);
  const [readingFiles, setReadingFiles] = useState<ReadingFiles>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>(null);
  const [synthesisPhase, setSynthesisPhase] = useState(-1);
  const [message, setMessage] = useState("");
  const [googleToken, setGoogleToken] = useState("");
  const [previewSourceId, setPreviewSourceId] = useState("");
  const [contextSourceId, setContextSourceId] = useState("");
  const [contextDraft, setContextDraft] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => {
      const current = getCurrentWorkspace();
      setWorkspace(current);
      setLoaded(true);
      if (current) setStage(startingStage(current));
    };
    refresh();
    window.addEventListener("understudy:cloud-hydrated", refresh);
    return () => window.removeEventListener("understudy:cloud-hydrated", refresh);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  const transition = workspace?.transition;
  const roleSources = useMemo(() => workspace ? roleSourcesFor(workspace) : [], [workspace]);
  const originalSources = useMemo(() => workspace ? originalSourcesFor(workspace) : [], [workspace]);
  const reviewComplete = workspace ? reconstructionReviewed(workspace) : false;
  const criticalGaps = useMemo(() => transition && workspace ? blockingCriticalGaps(transition.gaps, workspace.interviewGapStates ?? {}) : [], [transition, workspace]);
  const openHandoffGaps = useMemo(() => transition && workspace ? transition.gaps.filter((gap) => !isDismissedInterviewGap(workspace.interviewGapStates[gap.question])) : [], [transition, workspace]);
  const evidenceComplete = Boolean(workspace?.evidenceCollectionComplete && workspace.roleEvidence && roleSources.length);
  const interviewComplete = Boolean(workspace?.interviewCompletedAt);
  const handoffAccepted = workspace?.successorReview?.status === "accepted";

  const stageComplete: Record<Stage, boolean> = {
    sources: evidenceComplete,
    map: reviewComplete,
    interview: interviewComplete,
    handoff: handoffAccepted,
  };

  const furthestAccessible = !evidenceComplete ? 0 : !reviewComplete ? 1 : !interviewComplete ? 2 : 3;
  const previewSource = transition?.sources.find((source) => source.id === previewSourceId) ?? null;

  function persist(next: PersonalWorkspace) {
    setWorkspace(next);
    saveWorkspace(next);
  }

  function go(next: Stage) {
    const index = stageIndex(next);
    if (index > furthestAccessible) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setStage(next);
    setMessage("");
  }

  async function analyseBatch(items: PendingEvidence[]) {
    if (!workspace || !items.length || analysisProgress) return;
    let current = workspace;
    setMessage("");
    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        setAnalysisProgress({ current: index + 1, total: items.length, name: item.title, phase: 0 });
        const ticker = window.setInterval(() => {
          setAnalysisProgress((progress) => progress ? { ...progress, phase: Math.min(progress.phase + 1, SOURCE_ANALYSIS_PHASES.length - 1) } : progress);
        }, 850);
        try {
          const response = await fetch("/api/reconstruct", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transition: {
                person: current.transition.person,
                role: current.transition.role,
                department: current.transition.department,
                successor: current.transition.successor,
                targetDate: current.transition.targetDate,
              },
              source: {
                title: item.title,
                text: item.text,
                provider: item.provider,
                kind: item.kind ?? "document",
              },
            }),
          });
          const payload = (await response.json()) as { result?: ReconstructionResult; error?: string };
          if (!response.ok || !payload.result) throw new Error(payload.error || `Could not analyse ${item.title}.`);
          current = appendEvidenceResult(current, payload.result, item.text);
        } finally {
          window.clearInterval(ticker);
        }
      }
      persist(current);
      setQueued([]);
      setSourceTitle("");
      setSourceText("");
      setAdding(false);
      setMessage(`${items.length} source${items.length === 1 ? "" : "s"} added. Understudy kept each artifact separate. Add anything else, or connect the set when you are ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Understudy could not add this evidence.");
    } finally {
      setAnalysisProgress(null);
    }
  }

  async function queueFiles(files?: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files);
    const next: PendingEvidence[] = [];
    const errors: string[] = [];
    setMessage("");
    try {
      for (let index = 0; index < picked.length; index += 1) {
        const file = picked[index];
        setReadingFiles({ current: index + 1, total: picked.length, name: file.name });
        try {
          const text = await extractFileText(file);
          next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, title: file.name, text, provider: "Uploaded document" });
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : "could not be read"}`);
        }
      }
      setQueued((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...next.filter((item) => !existing.has(item.id))];
      });
      if (errors.length) setMessage(errors.join(" · "));
    } finally {
      setReadingFiles(null);
      if (uploadRef.current) uploadRef.current.value = "";
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
      setQueued((current) => [...current, { id: `drive-${picked.id}`, title: file.title, text: file.text, provider: "Google Drive" }]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Drive connection failed.");
    }
  }

  async function synthesizeRole(base: PersonalWorkspace) {
    const sources = roleSourcesFor(base)
      .map((source) => ({
        id: source.id,
        title: source.title,
        kind: source.kind,
        provider: source.provider,
        confidence: source.confidence,
        text: base.sourceBodies[source.id] ?? "",
      }))
      .filter((source) => source.text.trim());
    if (!sources.length) throw new Error("No readable evidence is stored for this handoff.");

    const response = await fetch("/api/synthesize-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transition: {
          person: base.transition.person,
          role: base.transition.role,
          department: base.transition.department,
          successor: base.transition.successor,
          targetDate: base.transition.targetDate,
        },
        sources,
        current: {
          summary: base.transition.summary,
          projects: base.transition.projects,
          risks: base.transition.risks,
          gaps: base.transition.gaps,
        },
      }),
    });
    const payload = (await response.json()) as { result?: WholeRoleSynthesisResult; error?: string };
    if (!response.ok || !payload.result) throw new Error(payload.error || "Could not connect this evidence set.");
    const result = payload.result;
    const now = new Date().toISOString();
    return {
      ...base,
      updatedAt: now,
      evidenceCollectionComplete: true,
      evidenceCollectionCompletedAt: now,
      roleEvidence: result.evidenceModel,
      reviewedSourceIds: [],
      interviewGapStates: {},
      interviewCompletedAt: undefined,
      successorReview: resetSuccessorReview(base),
      transition: {
        ...base.transition,
        summary: result.summary,
        projects: result.projects,
        risks: result.risks,
        gaps: result.gaps,
        metrics: result.metrics,
        readiness: result.readiness,
        status: result.readiness >= 80 ? "Ready for review" : result.readiness >= 55 ? "In progress" : "Needs attention",
      },
    } satisfies PersonalWorkspace;
  }

  async function finishEvidence() {
    if (!workspace || !roleSources.length || synthesisPhase >= 0) return;
    setSynthesisPhase(0);
    setMessage("");
    const ticker = window.setInterval(() => setSynthesisPhase((phase) => Math.min(phase + 1, SYNTHESIS_PHASES.length - 1)), 900);
    try {
      const next = await synthesizeRole(workspace);
      persist(next);
      setStage("map");
      setMessage(`Understudy connected ${roleSourcesFor(next).length} source${roleSourcesFor(next).length === 1 ? "" : "s"} into one role reconstruction. Review the overall interpretation once.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence synthesis failed.");
    } finally {
      window.clearInterval(ticker);
      setSynthesisPhase(-1);
    }
  }

  async function saveSourceContext(source: SourceItem) {
    if (!workspace || !contextDraft.trim() || contextBusy) return;
    setContextBusy(true);
    setMessage("");
    try {
      const clarificationId = `clarification-${source.id}`;
      const clarification: SourceItem = {
        id: clarificationId,
        title: `Context for ${source.title}`,
        kind: "interview",
        provider: "Source clarification",
        meta: `Added ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })} · self-reported`,
        extracted: ["Employee clarification"],
        confidence: "Self-reported",
      };
      const withoutOldClarification = workspace.transition.sources.filter((item) => item.id !== clarificationId);
      const base: PersonalWorkspace = {
        ...workspace,
        updatedAt: new Date().toISOString(),
        sourceReviewNotes: { ...workspace.sourceReviewNotes, [source.id]: contextDraft.trim() },
        sourceBodies: { ...workspace.sourceBodies, [clarificationId]: contextDraft.trim() },
        transition: { ...workspace.transition, sources: [...withoutOldClarification, clarification] },
      };
      const next = await synthesizeRole(base);
      persist(next);
      setContextSourceId("");
      setContextDraft("");
      setStage("map");
      setMessage(`Context for “${source.title}” was added as self-reported evidence and the reconstruction was updated. Review the overall map once.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add that source-specific context.");
    } finally {
      setContextBusy(false);
    }
  }

  function confirmReconstruction() {
    if (!workspace || !roleSources.length) return;
    const now = new Date().toISOString();
    const next: PersonalWorkspace = {
      ...workspace,
      updatedAt: now,
      reviewedSourceIds: roleSources.map((source) => source.id),
      interviewCompletedAt: undefined,
    };
    persist(next);
    setStage("interview");
    setMessage("Reconstruction confirmed. Understudy will now ask only about unresolved context that matters for continuity.");
  }

  function removeSource(source: SourceItem) {
    if (!workspace) return;
    if (!window.confirm(`Remove “${source.title}” from this handoff?`)) return;
    const clarificationId = `clarification-${source.id}`;
    const removedIds = new Set([source.id, clarificationId]);
    const bodies = { ...workspace.sourceBodies };
    removedIds.forEach((id) => delete bodies[id]);
    const notes = { ...workspace.sourceReviewNotes };
    delete notes[source.id];
    const next: PersonalWorkspace = {
      ...workspace,
      updatedAt: new Date().toISOString(),
      sourceBodies: bodies,
      sourceReviewNotes: notes,
      reviewedSourceIds: [],
      evidenceCollectionComplete: false,
      evidenceCollectionCompletedAt: undefined,
      roleEvidence: undefined,
      interviewGapStates: {},
      interviewCompletedAt: undefined,
      successorReview: resetSuccessorReview(workspace),
      transition: {
        ...workspace.transition,
        sources: workspace.transition.sources.filter((item) => !removedIds.has(item.id)),
        summary: "Evidence changed. Reconnect the current set so Understudy can rebuild the role map.",
        projects: [],
        risks: [],
        gaps: [],
        readiness: 0,
      },
    };
    persist(next);
    setStage("sources");
    setMessage(`Removed ${source.title}. Reconnect the remaining evidence when you are ready.`);
  }

  const handoff = useMemo(() => {
    if (!transition) return "";
    return `# ${transition.role} handoff\n\n**From:** ${transition.person}\n**To:** ${transition.successor}\n**Target:** ${transition.targetDate}\n\n## Role overview\n${transition.summary}\n\n## Active work\n${transition.projects.map((project) => `- **${project.name}** — ${project.state}; ${project.ownership}`).join("\n") || "- No active work reconstructed."}\n\n## Continuity risks\n${transition.risks.map((risk) => `- **${risk.title}** — ${risk.detail}`).join("\n") || "- No material risks identified."}\n\n## Open follow-ups\n${openHandoffGaps.map((gap) => `- ${gap.question}`).join("\n") || "- No open follow-ups."}`;
  }, [transition, openHandoffGaps]);

  if (!loaded) {
    return <div className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-3xl px-5 py-24 text-center"><motion.div animate={reducedMotion ? undefined : { opacity: [0.3, 1, 0.3], scaleX: [0.75, 1, 0.75] }} transition={{ repeat: Infinity, duration: 1.25 }} className="mx-auto h-1.5 w-28 rounded-full bg-accent" /><p className="mt-4 text-sm text-subtle">Opening this handoff…</p></div></div>;
  }

  if (!workspace || !transition) {
    return <div className="min-h-screen bg-background px-5 py-20 text-center text-foreground"><h1 className="text-2xl font-semibold">No handoff selected.</h1><p className="mt-2 text-sm text-muted">Choose an existing handoff or create a new one.</p><div className="mt-6 flex justify-center gap-2"><Link href="/" className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted">My handoffs</Link><Link href="/new" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">New handoff</Link></div></div>;
  }

  const currentIndex = stageIndex(stage);
  const visibleSources = showAllSources ? originalSources : originalSources.slice(0, 6);
  const ownedProjects = transition.projects.filter((project) => assignedOwnership(project.ownership)).length;
  const reviewChecksDone = workspace.successorReview ? SUCCESSOR_REVIEW_CHECKS.filter((item) => workspace.successorReview?.checks[item.key]).length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</Link>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{transition.person} → {transition.successor}</p><p className="truncate text-xs text-subtle">{transition.role} handoff</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">My handoffs</Link>
            <Link href="/ask" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover sm:inline-flex">Ask Understudy</Link>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-7 lg:px-8 lg:pt-10">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Step {currentIndex + 1} of 4</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {STAGES.map((item, index) => {
              const active = item.key === stage;
              const complete = stageComplete[item.key];
              const accessible = index <= furthestAccessible;
              return (
                <button key={item.key} disabled={!accessible} onClick={() => go(item.key)} className={`relative rounded-xl px-3 py-3 text-left ${accessible ? "hover:bg-card" : "cursor-default opacity-40"}`}>
                  {active && <motion.div layoutId="guided-stage" className="absolute inset-0 rounded-xl border border-border-strong bg-card shadow-sm" transition={{ type: "spring", stiffness: 430, damping: 38 }} />}
                  <div className="relative flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${complete ? "border-accent bg-accent text-white" : active ? "border-border-strong bg-background" : "border-border bg-background text-faint"}`}>{complete ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}</span><div><p className={`text-xs font-medium ${active || complete ? "text-foreground" : "text-subtle"}`}>{item.plain}</p><p className="text-[11px] text-faint">{item.product}</p></div></div>
                </button>
              );
            })}
          </div>
        </div>

        {message && <motion.div key={message} initial={reducedMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted">{message}</motion.div>}

        <motion.main key={stage} initial={reducedMotion ? false : { opacity: 0.72, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }} className="min-h-[620px]">
          {stage === "sources" && (
            <section className="mx-auto max-w-3xl">
              <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Give Understudy the work that already exists.</h1><p className="mt-3 text-base leading-7 text-muted">Add normal work artifacts. Understudy keeps every file separate while it reads them, then connects the set only when you choose to continue.</p></div>

              {originalSources.length > 0 && !adding && <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{originalSources.length} source{originalSources.length === 1 ? "" : "s"} in this handoff</p><p className="mt-1 text-xs leading-5 text-subtle">Opening this step does not invalidate your reconstruction. It changes only when you actually add or remove evidence.</p></div><button onClick={() => setAdding(true)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted">Add another source</button></div><div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">{visibleSources.map((source) => <div key={source.id} className="flex items-center gap-3 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"><IconFile className="h-4 w-4 text-muted" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.title}</p><p className="text-xs text-subtle">{evidenceLabel(source)}</p></div><button onClick={() => setPreviewSourceId(source.id)} className="text-xs text-subtle">View</button><button onClick={() => removeSource(source)} className="text-xs text-faint hover:text-danger">Remove</button></div>)}</div>{originalSources.length > 6 && <button onClick={() => setShowAllSources((value) => !value)} className="mt-3 text-xs font-medium text-accent">{showAllSources ? "Show less" : `View all ${originalSources.length}`}</button>}</div>}

              {(adding || !originalSources.length) && <div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex gap-1 border-b border-border p-2">{(["upload", "paste", "drive"] as SourceMode[]).map((mode) => <button key={mode} onClick={() => setSourceMode(mode)} className={`rounded-lg px-3 py-2 text-xs font-medium ${sourceMode === mode ? "bg-foreground text-background" : "text-muted hover:bg-background"}`}>{mode === "upload" ? "Upload files" : mode === "paste" ? "Paste text" : "Google Drive"}</button>)}</div><div className="p-5">
                {sourceMode === "upload" && <><button disabled={Boolean(readingFiles || analysisProgress)} onClick={() => uploadRef.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-6 text-center disabled:cursor-wait"><IconUpload className="text-muted" /><p className="mt-3 text-sm font-medium">Choose one or more work files</p><p className="mt-1 max-w-md text-xs leading-5 text-subtle">{SUPPORTED_UPLOAD_LABEL}</p></button><input ref={uploadRef} type="file" multiple accept={SUPPORTED_UPLOAD_ACCEPT} className="hidden" onChange={(event) => void queueFiles(event.target.files)} /></>}
                {readingFiles && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3"><motion.span animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-accent/30 border-t-accent" /><div><p className="text-sm font-medium">Reading file {readingFiles.current} of {readingFiles.total}</p><p className="text-xs text-subtle">{readingFiles.name}</p></div></motion.div>}
                {sourceMode === "paste" && <div><input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" /><textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={8} placeholder="Paste the artifact exactly as it exists…" className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none" /><button disabled={!sourceTitle.trim() || !sourceText.trim() || Boolean(analysisProgress)} onClick={() => void analyseBatch([{ id: crypto.randomUUID(), title: sourceTitle.trim(), text: sourceText.trim(), provider: sourceProvider }])} className="mt-3 h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-35">Add this source</button></div>}
                {sourceMode === "drive" && <div className="py-8 text-center"><p className="text-sm font-medium">Choose the exact Drive file Understudy may read</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-subtle">Understudy does not scan your Drive.</p><button onClick={() => void connectDrive()} className="mt-4 h-10 rounded-lg border border-border-strong px-4 text-sm font-medium text-muted">Choose Drive file</button></div>}
                <Link href="/recover-ai" className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-background p-4 hover:border-border-strong"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><span><span className="block text-sm font-medium">Recover AI context</span><span className="mt-1 block text-xs leading-5 text-subtle">Bring in rationale or history from ChatGPT, Claude, or Gemini when it is genuinely useful.</span></span></Link>

                {queued.length > 0 && !analysisProgress && <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background"><div className="border-b border-border px-3 py-2.5 text-sm font-medium">{queued.length} file{queued.length === 1 ? "" : "s"} ready</div><div className="max-h-56 divide-y divide-border overflow-auto">{queued.map((item) => <div key={item.id} className="flex items-center gap-3 px-3 py-3"><IconFile className="h-4 w-4 text-muted" /><p className="min-w-0 flex-1 truncate text-sm text-muted">{item.title}</p><button onClick={() => setQueued((current) => current.filter((candidate) => candidate.id !== item.id))} className="text-xs text-faint">Remove</button></div>)}</div><div className="p-3"><button onClick={() => void analyseBatch(queued)} className="h-11 w-full rounded-lg bg-foreground text-sm font-medium text-background">Read and add {queued.length} source{queued.length === 1 ? "" : "s"}</button></div></div>}

                {analysisProgress && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-background"><div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Building the evidence map</p><p className="mt-1 truncate text-xs text-subtle">{analysisProgress.name}</p></div><span className="text-xs font-medium text-accent">{analysisProgress.current}/{analysisProgress.total}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${Math.max(8, (analysisProgress.current / analysisProgress.total) * 100)}%` }} transition={{ type: "spring", stiffness: 180, damping: 25 }} /></div><div className="mt-5 space-y-2">{SOURCE_ANALYSIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-3 text-sm ${index <= analysisProgress.phase ? "text-muted" : "text-faint"}`}><motion.span animate={index === analysisProgress.phase && !reducedMotion ? { scale: [1, 1.5, 1], opacity: [0.55, 1, 0.55] } : undefined} transition={{ repeat: Infinity, duration: 1 }} className={`h-2 w-2 rounded-full ${index < analysisProgress.phase ? "bg-ok" : index === analysisProgress.phase ? "bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div></div></motion.div>}

                {originalSources.length > 0 && !analysisProgress && <button onClick={() => { setAdding(false); setQueued([]); if (evidenceComplete) setStage("map"); }} className="mt-4 text-sm font-medium text-subtle hover:text-muted">{evidenceComplete ? "Back to reconstruction" : "Done adding for now"}</button>}
              </div></div>}

              {synthesisPhase >= 0 && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-accent/20 bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><motion.span animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className="h-5 w-5 rounded-full border-2 border-accent/25 border-t-accent" /><div><p className="text-sm font-medium">Connecting the evidence into one role</p><p className="text-xs text-subtle">This is where Understudy compares the files with each other.</p></div></div><div className="mt-5 space-y-3">{SYNTHESIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-3 text-sm ${index <= synthesisPhase ? "text-muted" : "text-faint"}`}><span className={`h-2 w-2 rounded-full ${index < synthesisPhase ? "bg-ok" : index === synthesisPhase ? "bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div></motion.div>}

              {originalSources.length > 0 && !adding && synthesisPhase < 0 && <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{evidenceComplete ? "Your current evidence set is already connected." : "Ready to connect the current evidence set?"}</p><p className="mt-1 max-w-xl text-xs leading-5 text-subtle">{evidenceComplete ? "You can return to the reconstruction without rebuilding anything." : "Understudy will compare the artifacts as one set. You can still add more evidence later."}</p></div>{evidenceComplete ? <button onClick={() => go("map")} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Back to reconstruction <IconChevronRight className="ml-1 inline" /></button> : <button onClick={() => void finishEvidence()} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Connect the evidence <IconChevronRight className="ml-1 inline" /></button>}</div>}
            </section>
          )}

          {stage === "map" && (
            <section className="mx-auto max-w-3xl">
              <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Check the reconstruction once.</h1><p className="mt-3 text-base leading-7 text-muted">You are confirming the overall interpretation of the evidence set. You do not need to approve every file one by one.</p></div>

              {workspace.roleEvidence && <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">What Understudy thinks this role contains</p><p className="mt-2 text-sm leading-6 text-muted">{workspace.roleEvidence.overview}</p></div><span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-subtle">{workspace.roleEvidence.domains.length} work areas</span></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{workspace.roleEvidence.domains.slice(0, 6).map((domain) => <div key={domain.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{domain.name}</p><span className={`text-[11px] font-medium ${domain.status === "Covered" ? "text-ok" : domain.status === "Partial" ? "text-warning" : "text-danger"}`}>{domain.status}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-subtle">{domain.description}</p></div>)}</div></div>}

              <div className="mt-6 overflow-hidden rounded-2xl border border-border-strong bg-card shadow-sm"><div className="border-b border-border p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Evidence behind this reconstruction</p><p className="mt-1 text-xs leading-5 text-subtle">Inspect only what you need. Confirm the reconstruction once at the bottom.</p></div><span className="text-xs text-subtle">{roleSources.length} sources</span></div></div><div className="divide-y divide-border">{roleSources.map((source) => {
                const domains = domainsForSource(workspace, source.id);
                const original = !isClarification(source);
                const contextOpen = contextSourceId === source.id;
                return <div key={source.id} className="p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="h-4 w-4 text-muted" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.title}</p><p className="mt-0.5 text-xs text-subtle">{evidenceLabel(source)}{domains.length ? ` · supports ${domains.slice(0, 2).map((domain) => domain.name).join(", ")}` : ""}</p></div><button onClick={() => setPreviewSourceId(source.id)} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted">View</button>{original && <button onClick={() => { setContextSourceId(contextOpen ? "" : source.id); setContextDraft(workspace.sourceReviewNotes[source.id] ?? ""); }} className="shrink-0 text-xs font-medium text-accent">{contextOpen ? "Close" : "Add context"}</button>}</div>{contextOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-12 mt-4 overflow-hidden"><div className="rounded-xl border border-border bg-background p-4"><p className="text-sm font-medium">Add context for {source.title}</p><p className="mt-1 text-xs leading-5 text-subtle">Use this only for something the file cannot say by itself: what changed, why a decision happened, an exception, or something a successor would otherwise miss.</p><textarea value={contextDraft} onChange={(event) => setContextDraft(event.target.value)} rows={5} placeholder={`What should the next owner know about ${source.title}?`} className="mt-3 w-full rounded-lg border border-border bg-card p-3 text-sm leading-6 outline-none" /><div className="mt-3 flex justify-end gap-2"><button onClick={() => setContextSourceId("")} className="h-9 rounded-lg border border-border px-3 text-xs text-muted">Cancel</button><button disabled={!contextDraft.trim() || contextBusy} onClick={() => void saveSourceContext(source)} className="h-9 rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-40">{contextBusy ? "Updating reconstruction…" : "Add this context"}</button></div></div></motion.div>}</div>;
              })}</div></div>

              <div className="mt-6 border-t border-border pt-5"><button onClick={() => setShowDetails((value) => !value)} className="text-sm font-medium text-muted">{showDetails ? "Hide supporting details" : "Show risks, contradictions, and likely missing areas"}</button>{showDetails && workspace.roleEvidence && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><p className="text-sm font-medium">Continuity risks</p><div className="mt-3 space-y-2">{transition.risks.length ? transition.risks.map((risk) => <p key={risk.title} className="text-xs leading-5 text-subtle">{risk.title}</p>) : <p className="text-xs text-subtle">No material risks identified.</p>}</div></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-sm font-medium">Likely missing areas</p><div className="mt-3 space-y-2">{workspace.roleEvidence.missingAreas.length ? workspace.roleEvidence.missingAreas.map((area) => <p key={area} className="text-xs leading-5 text-subtle">{area}</p>) : <p className="text-xs text-subtle">No additional missing areas suggested.</p>}</div></div></div>}</div>

              <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">Does this overall reconstruction look materially right?</p><p className="mt-1 text-xs leading-5 text-subtle">This is one confirmation for the whole evidence set. You can still inspect or correct any individual source first.</p></div><button onClick={confirmReconstruction} className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-white">Confirm reconstruction <IconChevronRight className="ml-1 inline" /></button></div>

              <div className="mt-5 flex items-center justify-between"><button onClick={() => { setStage("sources"); setAdding(false); }} className="text-sm font-medium text-subtle">← Back to evidence</button><button onClick={() => { setStage("sources"); setAdding(true); }} className="text-sm font-medium text-accent">Add another source</button></div>
            </section>
          )}

          {stage === "interview" && (
            <section className="mx-auto max-w-3xl">
              <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Fill only the gaps that matter.</h1><p className="mt-3 text-base leading-7 text-muted">Questions disappear only when they are answered or explicitly classified. Unknowns remain visible as follow-ups instead of vanishing.</p></div>
              <div className="mt-7"><AdaptiveInterview workspace={workspace} onWorkspaceChange={persist} onMessage={setMessage} /></div>
              <div className="mt-7 flex items-center justify-between"><button onClick={() => go("map")} className="text-sm font-medium text-subtle">← Back to reconstruction</button>{workspace.interviewCompletedAt && <button onClick={() => go("handoff")} className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Continue to handoff verification <IconChevronRight className="ml-1 inline" /></button>}</div>
            </section>
          )}

          {stage === "handoff" && interviewComplete && (
            <section className="mx-auto max-w-3xl">
              {handoffAccepted ? <div className="rounded-3xl border border-ok/25 bg-card p-8 text-center shadow-sm sm:p-10"><motion.span initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-6 w-6" /></motion.span><p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-ok">Handoff complete</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">{transition.successor} has accepted the handoff.</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">The evidence was collected, the reconstruction was reviewed, the gap review was finished, and the successor explicitly verified the transfer.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/" className="h-11 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white">Back to my handoffs</Link><button onClick={async () => { await navigator.clipboard.writeText(handoff); setMessage("Handoff copied as Markdown."); }} className="h-11 rounded-lg border border-border px-5 text-sm font-medium text-muted">Copy handoff record</button></div></div> : <>
                <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Make sure the next owner can actually continue.</h1><p className="mt-3 text-base leading-7 text-muted">The handoff draft is ready. The final product event is the successor explicitly verifying what they are inheriting.</p></div>
                <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold">{ownedProjects}/{transition.projects.length || 0}</p><p className="mt-1 text-xs leading-5 text-subtle">active work items have an identified owner</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold">{criticalGaps.length}</p><p className="mt-1 text-xs leading-5 text-subtle">critical gaps still open</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold">{reviewChecksDone}/5</p><p className="mt-1 text-xs leading-5 text-subtle">successor verification checks complete</p></div></div>
                <div className="mt-6 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Handoff draft</p><p className="mt-1 text-xs text-subtle">Generated from reviewed evidence, explicit clarifications, and the gap review.</p></div><button onClick={async () => { await navigator.clipboard.writeText(handoff); setMessage("Handoff copied as Markdown."); }} className="rounded-lg border border-border px-3 py-2 text-xs text-muted">Copy</button></div><pre className="mt-4 max-h-[430px] overflow-auto whitespace-pre-wrap rounded-xl bg-background p-4 font-sans text-sm leading-7 text-muted">{handoff}</pre></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/recover-ai" className="rounded-2xl border border-border bg-card p-5 hover:border-border-strong"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><p className="mt-3 text-sm font-medium">Remembered something from AI?</p><p className="mt-1 text-xs leading-5 text-subtle">Recover AI context. New evidence will reopen Collect and rebuild the handoff instead of silently changing a finished draft.</p></Link><Link href="/review" className="rounded-2xl border border-accent/30 bg-accent px-5 py-5 text-white shadow-sm"><p className="text-sm font-medium">Continue to successor review</p><p className="mt-1 text-xs leading-5 text-white/75">{transition.successor} verifies scope, active work, ownership, risks, and open questions.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">Start verification <IconChevronRight /></span></Link></div>
                <div className="mt-5"><button onClick={() => go("interview")} className="text-sm font-medium text-subtle">← Back to gap review</button></div>
              </>}
            </section>
          )}
        </motion.main>
      </div>

      <SourcePreviewDialog source={previewSource} body={previewSource ? workspace.sourceBodies[previewSource.id] ?? "" : ""} onClose={() => setPreviewSourceId("")} title="Evidence source" />
    </div>
  );
}
