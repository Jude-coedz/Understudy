"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { SUCCESSOR_REVIEW_CHECKS } from "@/lib/successor-review";
import { AdaptiveInterview } from "./adaptive-interview";
import { CloudAccountControl } from "./cloud-account-control";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconSpark,
  IconUpload,
} from "./icons";

type Stage = "sources" | "map" | "interview" | "handoff";
type SourceMode = "upload" | "paste" | "drive";

type PendingEvidence = {
  id: string;
  title: string;
  text: string;
  provider: string;
  kind?: EvidenceKind;
};

const STAGES: Array<{ key: Stage; plain: string; product: string }> = [
  { key: "sources", plain: "Collect", product: "Evidence" },
  { key: "map", plain: "Understand", product: "Reconstruction" },
  { key: "interview", plain: "Fill the gaps", product: "Interview" },
  { key: "handoff", plain: "Hand over", product: "Verification" },
];

const SYNTHESIS_PHASES = [
  "Reading the full evidence set",
  "Connecting related work",
  "Checking support and contradictions",
  "Finding what still needs a human",
];

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 12) {
  const seen = new Set<string>();
  return [...incoming, ...existing]
    .filter((item) => {
      const value = key(item).trim().toLowerCase();
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, limit);
}

function mergeEvidenceResult(workspace: PersonalWorkspace, result: ReconstructionResult, text: string) {
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
    interviewGapStates: {},
    roleEvidence: undefined,
  } satisfies PersonalWorkspace;
}

function evidenceLabel(source: SourceItem) {
  if (source.kind === "github") return "GitHub";
  if (source.kind === "ai-context") return "AI-recovered";
  if (source.kind === "interview") return "Interview";
  return source.provider;
}

function stageIndex(stage: Stage) {
  return STAGES.findIndex((item) => item.key === stage);
}

function assignedOwnership(value: string) {
  return !/unassigned|unknown|unclear|not assigned|tbd/i.test(value);
}

export function LinearWorkspace() {
  const reducedMotion = useReducedMotion();
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
  const [busy, setBusy] = useState(false);
  const [synthesisPhase, setSynthesisPhase] = useState(-1);
  const [message, setMessage] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [googleToken, setGoogleToken] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const current = getCurrentWorkspace();
    setWorkspace(current);
    if (!current) return;
    const evidence = current.transition.sources.filter((source) => source.kind !== "interview");
    const unreviewed = evidence.filter((source) => !current.reviewedSourceIds.includes(source.id));
    const critical = blockingCriticalGaps(current.transition.gaps, current.interviewGapStates ?? {});
    if (!current.evidenceCollectionComplete || !current.roleEvidence) setStage("sources");
    else if (unreviewed.length) setStage("map");
    else if (critical.length) setStage("interview");
    else setStage("handoff");
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
  const activeGaps = useMemo(
    () => transition ? rankedInterviewGaps(transition.gaps, transition.risks, gapStates) : [],
    [transition, gapStates],
  );
  const openHandoffGaps = useMemo(
    () => transition?.gaps.filter((gap) => !isDismissedInterviewGap(gapStates[gap.question])) ?? [],
    [transition, gapStates],
  );

  const evidenceComplete = Boolean(workspace?.evidenceCollectionComplete && workspace.roleEvidence && evidenceSources.length);
  const reconstructionReviewed = evidenceComplete && unreviewed.length === 0;
  const handoffUnlocked = reconstructionReviewed && criticalGaps.length === 0;

  const stageComplete: Record<Stage, boolean> = {
    sources: evidenceComplete,
    map: reconstructionReviewed,
    interview: reconstructionReviewed && criticalGaps.length === 0,
    handoff: workspace?.successorReview?.status === "accepted",
  };

  const furthestAccessible = !evidenceSources.length || !evidenceComplete
    ? 0
    : unreviewed.length
      ? 1
      : criticalGaps.length || (activeGaps.length && !interviewSources.length)
        ? 2
        : 3;

  function persist(next: PersonalWorkspace) {
    setWorkspace(next);
    saveWorkspace(next);
  }

  function go(next: Stage) {
    const index = stageIndex(next);
    if (index > furthestAccessible) return;
    setStage(next);
    setMessage("");
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  async function analyseBatch(items: PendingEvidence[]) {
    if (!workspace || !items.length || busy) return;
    setBusy(true);
    setMessage("");
    let current = workspace;
    try {
      for (const item of items) {
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
        current = mergeEvidenceResult(current, payload.result, item.text);
      }
      persist(current);
      setQueued([]);
      setSourceTitle("");
      setSourceText("");
      setAdding(false);
      setMessage(`${items.length} source${items.length === 1 ? " was" : "s were"} added. Add anything else that matters, then finish collection when you are ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Understudy could not add this evidence.");
    } finally {
      setBusy(false);
    }
  }

  async function queueFiles(files?: FileList | null) {
    if (!files?.length) return;
    setMessage("");
    const next: PendingEvidence[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
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
    if (uploadRef.current) uploadRef.current.value = "";
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

  async function finishEvidence() {
    setFinishOpen(false);
    if (!workspace || !evidenceSources.length || synthesisPhase >= 0) return;
    const sources = evidenceSources
      .map((source) => ({
        id: source.id,
        title: source.title,
        kind: source.kind,
        provider: source.provider,
        confidence: source.confidence,
        text: workspace.sourceBodies[source.id] ?? "",
      }))
      .filter((source) => source.text.trim());
    if (!sources.length) {
      setMessage("The stored source content is missing, so Understudy cannot synthesize this handoff yet.");
      return;
    }

    setSynthesisPhase(0);
    setMessage("");
    const timer = window.setInterval(() => setSynthesisPhase((value) => Math.min(value + 1, SYNTHESIS_PHASES.length - 1)), 800);
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
          sources,
          current: {
            summary: workspace.transition.summary,
            projects: workspace.transition.projects,
            risks: workspace.transition.risks,
            gaps: workspace.transition.gaps,
          },
        }),
      });
      const payload = (await response.json()) as { result?: WholeRoleSynthesisResult; usedModel?: boolean; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not synthesize this evidence set.");
      const now = new Date().toISOString();
      const result = payload.result;
      persist({
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
      });
      setStage("map");
      setMessage(`Understudy connected ${sources.length} source${sources.length === 1 ? "" : "s"} into one role-level map. Review what it understood before continuing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence synthesis failed.");
    } finally {
      window.clearInterval(timer);
      setSynthesisPhase(-1);
    }
  }

  function verifyCurrentSource() {
    if (!workspace || !unreviewed[0]) return;
    const source = unreviewed[0];
    const next = {
      ...workspace,
      updatedAt: new Date().toISOString(),
      reviewedSourceIds: [...new Set([...workspace.reviewedSourceIds, source.id])],
    };
    persist(next);
    const remaining = unreviewed.length - 1;
    setMessage(remaining ? `${source.title} reviewed. ${remaining} source${remaining === 1 ? " remains" : "s remain"}.` : "Source review complete. Understudy can now focus only on context the evidence did not answer.");
  }

  function removeSource(source: SourceItem) {
    if (!workspace) return;
    if (!window.confirm(`Remove “${source.title}” from this handoff? The role map will need to be rebuilt.`)) return;
    const bodies = { ...workspace.sourceBodies };
    delete bodies[source.id];
    const remaining = workspace.transition.sources.filter((item) => item.id !== source.id);
    persist({
      ...workspace,
      updatedAt: new Date().toISOString(),
      transition: {
        ...workspace.transition,
        sources: remaining,
        summary: "Evidence changed. Finish collection again so Understudy can rebuild the handoff from the updated evidence set.",
        projects: [], risks: [], gaps: [], readiness: 0,
      },
      sourceBodies: bodies,
      reviewedSourceIds: workspace.reviewedSourceIds.filter((id) => id !== source.id),
      evidenceCollectionComplete: false,
      evidenceCollectionCompletedAt: undefined,
      roleEvidence: undefined,
      interviewGapStates: {},
      successorReview: workspace.successorReview ? {
        ...workspace.successorReview,
        status: "pending",
        acceptedAt: undefined,
        updatedAt: new Date().toISOString(),
        checks: { roleScope: false, activeWork: false, ownership: false, risks: false, openQuestions: false },
      } : undefined,
    });
    setStage("sources");
    setMessage(`Removed ${source.title}. The previous reconstruction was invalidated.`);
  }

  function reopenEvidence() {
    if (!workspace) return;
    persist({
      ...workspace,
      updatedAt: new Date().toISOString(),
      evidenceCollectionComplete: false,
      evidenceCollectionCompletedAt: undefined,
      roleEvidence: undefined,
      reviewedSourceIds: [],
    });
    setStage("sources");
    setAdding(true);
  }

  const handoff = useMemo(() => {
    if (!transition) return "";
    return `# ${transition.role} handoff\n\n**From:** ${transition.person}\n**To:** ${transition.successor}\n**Target:** ${transition.targetDate}\n\n## Role overview\n${transition.summary}\n\n## Active work\n${transition.projects.map((project) => `- **${project.name}** — ${project.state}; ${project.ownership}`).join("\n") || "- No active work reconstructed."}\n\n## Continuity risks\n${transition.risks.map((risk) => `- **${risk.title}** — ${risk.detail}`).join("\n") || "- No material risks identified."}\n\n## Open questions\n${openHandoffGaps.map((gap) => `- ${gap.question}`).join("\n") || "- No open questions from the current evidence."}`;
  }, [transition, openHandoffGaps]);

  if (!workspace || !transition) {
    return (
      <div className="min-h-screen bg-background px-5 py-20 text-center text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Start a handoff first.</h1>
        <p className="mt-2 text-sm text-muted">Understudy needs a person, role, successor, and first artifact before opening the workspace.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background">Start a handoff</Link>
      </div>
    );
  }

  const currentIndex = stageIndex(stage);
  const visibleSources = showAllSources ? evidenceSources : evidenceSources.slice(-3).reverse();
  const currentReviewSource = unreviewed[0];
  const ownedProjects = transition.projects.filter((project) => assignedOwnership(project.ownership)).length;
  const reviewChecksDone = workspace.successorReview ? SUCCESSOR_REVIEW_CHECKS.filter((item) => workspace.successorReview?.checks[item.key]).length : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{transition.person} → {transition.successor}</p>
              <p className="truncate text-xs text-subtle">{transition.role} handoff</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ask" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover sm:inline-flex">Ask Understudy</Link>
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center rounded-lg border border-border bg-card px-3 text-xs text-muted hover:bg-card-hover">More</summary>
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl">
                <Link href="/recover-ai" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-background">Recover AI context</Link>
                <Link href="/integrations" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-background">Integrations</Link>
                <Link href="/review" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-background">Successor review</Link>
                <Link href="/transitions" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-background">Example transitions</Link>
              </div>
            </details>
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
                <button
                  key={item.key}
                  type="button"
                  disabled={!accessible}
                  onClick={() => go(item.key)}
                  className={`relative overflow-hidden rounded-xl px-3 py-3 text-left ${accessible ? "cursor-pointer" : "cursor-default opacity-45"}`}
                >
                  {active && <motion.div layoutId="workspace-stage" className="absolute inset-0 rounded-xl border border-border-strong bg-card shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
                  <div className="relative flex items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${complete ? "border-accent bg-accent text-white" : active ? "border-border-strong bg-background" : "border-border bg-background text-faint"}`}>
                      {complete ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <div><p className={`text-xs font-medium ${active || complete ? "text-foreground" : "text-subtle"}`}>{item.plain}</p><p className="text-[11px] text-faint">{item.product}</p></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {message && (
            <motion.div key={message} role="status" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mb-5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-6 text-muted">
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={stage}
            initial={reducedMotion ? false : { opacity: 0, x: 18, filter: "blur(3px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -14, filter: "blur(2px)" }}
            transition={reducedMotion ? { duration: 0 } : { opacity: { duration: 0.22 }, x: { type: "spring", stiffness: 360, damping: 34 }, filter: { duration: 0.18 } }}
          >
            {stage === "sources" && (
              <section className="mx-auto max-w-3xl">
                <div className="max-w-2xl">
                  <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Give Understudy the work that already exists.</h1>
                  <p className="mt-3 text-base leading-7 text-muted">Start with normal work artifacts. You do not need to organize them first. Understudy keeps each source separate, then connects them only when you say you are done collecting.</p>
                </div>

                {evidenceSources.length > 0 && !adding && (
                  <motion.div layout className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-sm font-medium">{evidenceSources.length} source{evidenceSources.length === 1 ? "" : "s"} collected</p><p className="mt-1 text-xs leading-5 text-subtle">You can keep adding files from different projects, months, or products. Document count is not treated as completeness.</p></div>
                      <button onClick={() => setAdding(true)} className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-background">Add more</button>
                    </div>
                    <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                      <AnimatePresence initial={false}>
                        {visibleSources.map((source) => (
                          <motion.div layout key={source.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-3 py-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"><IconFile className="h-4 w-4 text-muted" /></span>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{source.title}</p><p className="mt-0.5 text-xs text-subtle">{evidenceLabel(source)}</p></div>
                            <button onClick={() => removeSource(source)} className="text-xs text-faint hover:text-danger">Remove</button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    {evidenceSources.length > 3 && <button onClick={() => setShowAllSources((value) => !value)} className="mt-3 text-xs font-medium text-accent">{showAllSources ? "Show less" : `View all ${evidenceSources.length} sources`}</button>}
                  </motion.div>
                )}

                <AnimatePresence initial={false}>
                  {(adding || evidenceSources.length === 0) && (
                    <motion.div layout initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.99 }} className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                      <div className="flex gap-1 border-b border-border p-2">
                        {(["upload", "paste", "drive"] as SourceMode[]).map((mode) => <button key={mode} onClick={() => setSourceMode(mode)} className={`rounded-lg px-3 py-2 text-xs font-medium ${sourceMode === mode ? "bg-foreground text-background" : "text-muted hover:bg-background"}`}>{mode === "upload" ? "Upload files" : mode === "paste" ? "Paste text" : "Google Drive"}</button>)}
                      </div>
                      <div className="p-5">
                        {sourceMode === "upload" && (
                          <div>
                            <motion.button whileHover={reducedMotion ? undefined : { scale: 1.005 }} whileTap={reducedMotion ? undefined : { scale: 0.995 }} onClick={() => uploadRef.current?.click()} className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-6 text-center">
                              <IconUpload className="text-muted" /><p className="mt-3 text-sm font-medium">Choose one or more work files</p><p className="mt-1 max-w-md text-xs leading-5 text-subtle">{SUPPORTED_UPLOAD_LABEL}. You can select another batch without replacing the first one.</p>
                            </motion.button>
                            <input ref={uploadRef} type="file" multiple accept={SUPPORTED_UPLOAD_ACCEPT} className="hidden" onChange={(event) => void queueFiles(event.target.files)} />
                          </div>
                        )}
                        {sourceMode === "paste" && (
                          <div><input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-border-strong" /><textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={9} placeholder="Paste the artifact exactly as it exists…" className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm leading-6 outline-none focus:border-border-strong" /><button disabled={busy || !sourceTitle.trim() || sourceText.trim().length < 20} onClick={() => void analyseBatch([{ id: crypto.randomUUID(), title: sourceTitle.trim(), text: sourceText.trim(), provider: sourceProvider }])} className="mt-3 h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-35">Add this source</button></div>
                        )}
                        {sourceMode === "drive" && (
                          <div className="py-8 text-center"><p className="text-sm font-medium">Choose the exact Drive file Understudy may read</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-subtle">Understudy does not scan your Drive. Each selected file remains a separate evidence source.</p><button onClick={() => void connectDrive()} className="mt-4 h-10 rounded-lg border border-border-strong bg-background px-4 text-sm font-medium text-muted">Choose Drive file</button></div>
                        )}

                        {queued.length > 0 && (
                          <motion.div layout className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                            <div className="flex items-center justify-between border-b border-border px-3 py-2.5"><p className="text-sm font-medium">{queued.length} queued</p><button onClick={() => setQueued([])} className="text-xs text-faint hover:text-danger">Clear</button></div>
                            <AnimatePresence initial={false}>{queued.map((item) => <motion.div layout key={item.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0"><IconFile className="h-4 w-4 text-muted" /><p className="min-w-0 flex-1 truncate text-sm text-muted">{item.title}</p><button onClick={() => setQueued((current) => current.filter((queuedItem) => queuedItem.id !== item.id))} className="text-xs text-faint hover:text-danger">Remove</button></motion.div>)}</AnimatePresence>
                            <div className="p-3"><button disabled={busy} onClick={() => void analyseBatch(queued)} className="h-10 w-full rounded-lg bg-foreground text-sm font-medium text-background disabled:opacity-50">{busy ? "Reading evidence…" : `Add ${queued.length} source${queued.length === 1 ? "" : "s"}`}</button></div>
                          </motion.div>
                        )}
                        {evidenceSources.length > 0 && <button onClick={() => { setAdding(false); setQueued([]); }} className="mt-4 text-xs text-subtle">Done adding for now</button>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {synthesisPhase >= 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm font-medium">Connecting the evidence into one role</p>
                    <div className="mt-4 space-y-3">{SYNTHESIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-3 text-sm ${index <= synthesisPhase ? "text-muted" : "text-faint"}`}><motion.span animate={index === synthesisPhase && !reducedMotion ? { scale: [1, 1.5, 1] } : undefined} transition={{ repeat: Infinity, duration: 1.1 }} className={`h-2 w-2 rounded-full ${index < synthesisPhase ? "bg-ok" : index === synthesisPhase ? "bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div>
                  </motion.div>
                )}

                {evidenceSources.length > 0 && synthesisPhase < 0 && !adding && (
                  <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-sm font-medium">Ready for Understudy to connect these sources?</p><p className="mt-1 max-w-xl text-xs leading-5 text-subtle">This means “use what I have now”, not “my role is 100% documented”. You can reopen collection later.</p></div>
                    <button onClick={() => setFinishOpen(true)} className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-white">Finish collecting <IconChevronRight className="ml-1 inline" /></button>
                  </div>
                )}
              </section>
            )}

            {stage === "map" && (
              <section className="mx-auto max-w-3xl">
                <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Check what Understudy understood.</h1><p className="mt-3 text-base leading-7 text-muted">Before Understudy asks anyone questions, confirm that its interpretation of the existing evidence is reasonable.</p></div>

                {workspace.roleEvidence && (
                  <div className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">Role reconstruction</p><p className="mt-2 text-sm leading-6 text-muted">{workspace.roleEvidence.overview}</p></div><span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-subtle">{workspace.roleEvidence.domains.length} work areas</span></div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">{workspace.roleEvidence.domains.slice(0, 6).map((domain) => <div key={domain.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{domain.name}</p><span className={`text-[11px] font-medium ${domain.status === "Covered" ? "text-ok" : domain.status === "Partial" ? "text-warning" : "text-danger"}`}>{domain.status}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-subtle">{domain.description}</p></div>)}</div>
                  </div>
                )}

                {currentReviewSource ? (
                  <motion.div key={currentReviewSource.id} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-border-strong bg-card p-5 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">Review {evidenceSources.length - unreviewed.length + 1} of {evidenceSources.length}</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">{currentReviewSource.title}</h2>
                    <p className="mt-1 text-xs text-subtle">{evidenceLabel(currentReviewSource)}</p>
                    <p className="mt-4 text-sm leading-6 text-muted">Understudy extracted: {currentReviewSource.extracted.join(" · ") || "No structured findings were extracted."}</p>
                    <div className="mt-5 flex flex-wrap gap-2"><button onClick={verifyCurrentSource} className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background">This interpretation looks reasonable</button><button onClick={reopenEvidence} className="h-10 rounded-lg border border-border px-4 text-sm text-muted">Add or correct evidence</button></div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 rounded-2xl border border-ok/25 bg-ok/5 p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck /></span><div><p className="text-sm font-medium">Evidence interpretation reviewed</p><p className="mt-1 text-sm leading-6 text-muted">Now Understudy can ask only about context the supplied evidence could not resolve.</p></div></div><button onClick={() => go("interview")} className="mt-5 h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Continue to missing context <IconChevronRight className="ml-1 inline" /></button></motion.div>
                )}

                <div className="mt-6 border-t border-border pt-5">
                  <button onClick={() => setShowDetails((value) => !value)} className="text-sm font-medium text-muted">{showDetails ? "Hide supporting details" : "Show risks, contradictions, and likely missing areas"}</button>
                  <AnimatePresence initial={false}>{showDetails && workspace.roleEvidence && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconAlert className="text-warning" /><p className="text-sm font-medium">Continuity risks</p></div><div className="mt-3 space-y-2">{transition.risks.map((risk) => <p key={risk.title} className="text-xs leading-5 text-subtle">{risk.title}</p>) || null}</div></div><div className="rounded-xl border border-border bg-card p-4"><p className="text-sm font-medium">Likely missing areas</p><div className="mt-3 space-y-2">{workspace.roleEvidence.missingAreas.length ? workspace.roleEvidence.missingAreas.map((area) => <p key={area} className="text-xs leading-5 text-subtle">{area}</p>) : <p className="text-xs text-subtle">No additional areas suggested.</p>}</div></div><div className="rounded-xl border border-border bg-card p-4 sm:col-span-2"><p className="text-sm font-medium">Cross-source contradictions</p><div className="mt-3 space-y-2">{workspace.roleEvidence.contradictions.length ? workspace.roleEvidence.contradictions.map((item) => <p key={item.claim} className="text-xs leading-5 text-subtle">{item.claim}</p>) : <p className="text-xs text-subtle">No material contradiction detected.</p>}</div></div></div></motion.div>}</AnimatePresence>
                </div>
              </section>
            )}

            {stage === "interview" && (
              <section className="mx-auto max-w-3xl">
                <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Fill only the gaps that matter.</h1><p className="mt-3 text-base leading-7 text-muted">No generic questionnaire. Understudy prioritizes the few unresolved things most likely to block the next owner.</p></div>
                <div className="mt-7"><AdaptiveInterview workspace={workspace} onWorkspaceChange={persist} onMessage={setMessage} /></div>
                {criticalGaps.length === 0 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-ok/25 bg-ok/5 p-5"><p className="text-sm font-medium">Critical transfer blockers are clear.</p><p className="mt-1 text-sm leading-6 text-muted">Lower-priority questions can stay visible without stopping the handoff.</p><button onClick={() => go("handoff")} className="mt-4 h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Prepare the handoff <IconChevronRight className="ml-1 inline" /></button></motion.div>}
              </section>
            )}

            {stage === "handoff" && handoffUnlocked && (
              <section className="mx-auto max-w-3xl">
                <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Make sure the next owner can actually continue.</h1><p className="mt-3 text-base leading-7 text-muted">A handoff is complete when ownership is explicit, critical gaps are resolved, and the successor has reviewed what they are inheriting.</p></div>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold tracking-tight">{ownedProjects}/{transition.projects.length || 0}</p><p className="mt-1 text-xs leading-5 text-subtle">active work items have an identified owner</p></div>
                  <div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold tracking-tight">{Math.max(0, transition.gaps.filter((gap) => gap.priority === "Critical").length - criticalGaps.length)}/{transition.gaps.filter((gap) => gap.priority === "Critical").length}</p><p className="mt-1 text-xs leading-5 text-subtle">critical gaps resolved</p></div>
                  <div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-semibold tracking-tight">{reviewChecksDone}/5</p><p className="mt-1 text-xs leading-5 text-subtle">successor verification checks completed</p></div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Handoff draft</p><p className="mt-1 text-xs text-subtle">Generated from the reviewed evidence and resolved context.</p></div><button onClick={async () => { await navigator.clipboard.writeText(handoff); setMessage("Handoff copied as Markdown."); }} className="rounded-lg border border-border px-3 py-2 text-xs text-muted">Copy</button></div><pre className="mt-4 max-h-[430px] overflow-auto whitespace-pre-wrap rounded-xl bg-background p-4 font-sans text-sm leading-7 text-muted">{handoff}</pre></div>

                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border-strong bg-card p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">The last step belongs to {transition.successor}.</p><p className="mt-1 text-xs leading-5 text-subtle">Their review is a real verification event, not an AI-generated score.</p></div><Link href="/review" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white">Start successor review <IconChevronRight className="ml-1" /></Link></div>
              </section>
            )}
          </motion.main>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {finishOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onMouseDown={() => setFinishOpen(false)}>
            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ type: "spring", stiffness: 390, damping: 32 }} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-border-strong bg-card p-6 shadow-2xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"><IconSpark /></span><h2 className="mt-4 text-xl font-semibold tracking-tight">Use these {evidenceSources.length} sources as the current evidence set?</h2><p className="mt-2 text-sm leading-6 text-muted">Understudy will connect them into a single role reconstruction. This does not certify that every part of the role has been captured.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setFinishOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm text-muted">Keep adding</button><button onClick={() => void finishEvidence()} className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Connect the evidence</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
