"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import { extractFileText, SUPPORTED_UPLOAD_ACCEPT, SUPPORTED_UPLOAD_LABEL } from "@/lib/file-extraction";
import {
  blankTransition,
  createWorkspace,
  getCurrentWorkspace,
  getIdentity,
  saveIdentity,
  saveWorkspace,
  type PersonalWorkspace,
  type UnderstudyIdentity,
} from "@/lib/personal-workspace";
import {
  connectGoogleDrive,
  googleDriveConfigured,
  pickGoogleDriveFile,
  readGoogleDriveFile,
} from "@/lib/google-drive";
import {
  IconCheck,
  IconChevronRight,
  IconFile,
  IconSpark,
  IconUpload,
} from "./icons";

type Step = "welcome" | "role" | "evidence" | "review";
type EvidenceMode = "paste" | "upload" | "drive";
type FieldName = "person" | "role" | "department" | "successor" | "targetDate" | "sourceTitle" | "sourceText";

type Errors = Partial<Record<FieldName, string>>;

type PendingEvidence = {
  id: string;
  title: string;
  text: string;
  provider: string;
};

const ANALYSIS_PHASES = [
  "Reading the source",
  "Mapping responsibilities and active work",
  "Recovering decisions and rationale",
  "Finding continuity risks",
  "Turning unknowns into interview questions",
];

function mergeUnique<T>(items: T[], key: (item: T) => string, limit = 24) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item).trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {label}
        {hint && (
          <span className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[10px] text-subtle" aria-label={hint}>
            ?
            <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-card p-3 text-left text-xs font-normal leading-5 text-muted shadow-2xl group-hover:block">
              {hint}
            </span>
          </span>
        )}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs leading-5 text-danger">{error}</span>}
    </label>
  );
}

function Progress({ step }: { step: Step }) {
  const index = step === "role" ? 0 : step === "evidence" ? 1 : step === "review" ? 2 : -1;
  if (index < 0) return null;
  return (
    <div className="mx-auto mb-8 flex max-w-lg items-center">
      {["Transition", "Evidence", "Review"].map((label, item) => (
        <div key={label} className={`flex items-center ${item < 2 ? "flex-1" : ""}`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${item < index ? "border-accent bg-accent text-white" : item === index ? "border-border-strong bg-card-hover text-foreground" : "border-border bg-card text-faint"}`}>
              {item < index ? <IconCheck className="h-3.5 w-3.5" /> : item + 1}
            </span>
            <span className={`hidden text-xs sm:block ${item <= index ? "text-muted" : "text-faint"}`}>{label}</span>
          </div>
          {item < 2 && <span className={`mx-3 h-px flex-1 ${item < index ? "bg-accent" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function ContextCard({ step, sourceTitle }: { step: Step; sourceTitle: string }) {
  const content = step === "role"
    ? {
        title: "Why Understudy asks this",
        body: "The role and successor change how the same document should be interpreted. Understudy uses this context to separate project details from actual handoff responsibilities.",
        detail: "Nothing here is treated as evidence about the work itself. It only frames the evidence you add next.",
      }
    : step === "evidence"
      ? {
          title: sourceTitle ? "Current source is only a starting point" : "Start with evidence that already exists",
          body: sourceTitle
            ? `Understudy will analyse “${sourceTitle}”, but it will not assume this one artifact represents the whole role.`
            : "A PRD, runbook, roadmap, project note, or Drive file is enough to begin. You will be asked for more evidence after the first reconstruction.",
          detail: "Do not rewrite the source for Understudy. Normal work artifacts are more useful than polished summaries.",
        }
      : {
          title: "This is a working reconstruction",
          body: "The first analysis is not the handoff. Open the workspace, add the rest of the evidence, review what Understudy inferred, then close only the highest-value gaps.",
          detail: "Every later claim should remain traceable to primary, AI-recovered, or self-reported evidence.",
        };

  return (
    <aside className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6">
      <p className="text-sm font-medium">{content.title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{content.body}</p>
      <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-subtle">{content.detail}</p>
    </aside>
  );
}

export function OnboardingFlowPolished() {
  const [step, setStep] = useState<Step>("welcome");
  const [existing, setExisting] = useState<PersonalWorkspace | null>(null);
  const [identity, setIdentityState] = useState<UnderstudyIdentity | null>(null);
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [successor, setSuccessor] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [transitionType, setTransitionType] = useState("Role transition");
  const [mode, setMode] = useState<EvidenceMode>("paste");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceProvider, setSourceProvider] = useState("Pasted evidence");
  const [uploadArtifacts, setUploadArtifacts] = useState<PendingEvidence[]>([]);
  const [analysisPhase, setAnalysisPhase] = useState(-1);
  const [analysisError, setAnalysisError] = useState("");
  const [usedModel, setUsedModel] = useState(false);
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [googleToken, setGoogleToken] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const refs = {
    person: useRef<HTMLInputElement>(null),
    role: useRef<HTMLInputElement>(null),
    department: useRef<HTMLInputElement>(null),
    successor: useRef<HTMLInputElement>(null),
    targetDate: useRef<HTMLInputElement>(null),
    sourceTitle: useRef<HTMLInputElement>(null),
    sourceText: useRef<HTMLTextAreaElement>(null),
  };

  useEffect(() => {
    setIdentityState(getIdentity());
    setExisting(getCurrentWorkspace());
  }, []);

  const hasRoleDraft = Boolean(person || role || department || successor || targetDate || transitionType !== "Role transition");
  const hasEvidenceDraft = Boolean(sourceTitle || sourceText || uploadArtifacts.length);
  const hasUnsavedDraft = !workspace && ((step === "role" && hasRoleDraft) || (step === "evidence" && (hasRoleDraft || hasEvidenceDraft)));

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedDraft) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedDraft]);

  const formattedDate = useMemo(() => {
    if (!targetDate) return "";
    const parsed = new Date(`${targetDate}T12:00:00`);
    return Number.isNaN(parsed.valueOf()) ? targetDate : parsed.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }, [targetDate]);

  function clearError(name: FieldName) {
    setErrors((current) => ({ ...current, [name]: undefined }));
    setNotice("");
  }

  function validateRole() {
    const next: Errors = {};
    if (!person.trim()) next.person = "Add the person currently handing over this work.";
    if (!role.trim()) next.role = "Add the role so Understudy can interpret responsibilities correctly.";
    if (!department.trim()) next.department = "Add the team or department this work belongs to.";
    if (!successor.trim()) next.successor = "Add the next owner, or use a team name if no person is assigned yet.";
    if (!targetDate) next.targetDate = "Choose the target handoff date.";
    setErrors(next);
    const first = (["person", "role", "department", "successor", "targetDate"] as FieldName[]).find((name) => next[name]);
    if (first) {
      refs[first as keyof typeof refs]?.current?.focus();
      setNotice("Complete the highlighted field before moving to evidence.");
      return false;
    }
    setNotice("");
    return true;
  }

  function validateEvidence() {
    const next: Errors = {};
    if (mode === "upload") {
      if (!uploadArtifacts.length) next.sourceText = "Choose at least one work file before reconstruction.";
    } else {
      if (!sourceTitle.trim()) next.sourceTitle = "Give this source a title so it can be cited later.";
      if (sourceText.trim().length < 40) next.sourceText = sourceText.trim().length
        ? "This source is too short to reconstruct reliably. Add at least a few complete sentences."
        : "Add or select a real work artifact before reconstruction.";
    }
    setErrors((current) => ({ ...current, sourceTitle: undefined, sourceText: undefined, ...next }));
    const first = (["sourceTitle", "sourceText"] as FieldName[]).find((name) => next[name]);
    if (first) {
      refs[first as keyof typeof refs]?.current?.focus();
      setNotice(mode === "upload"
        ? "Choose one or more usable files before Understudy reconstructs the work."
        : "Understudy needs a usable source before it can reconstruct the work.");
      return false;
    }
    setNotice("");
    return true;
  }

  function moveToEvidence() {
    if (!validateRole()) return;
    setErrors({});
    setStep("evidence");
  }

  function leaveDraft(action: () => void) {
    if (!hasUnsavedDraft || window.confirm("You have unfinished setup changes. Leave this step and discard them?")) action();
  }

  async function readUploads(files?: FileList | File[]) {
    const picked = files ? Array.from(files) : [];
    if (!picked.length) return;
    setAnalysisError("");

    const accepted: PendingEvidence[] = [];
    const failed: string[] = [];
    for (const file of picked) {
      try {
        const text = await extractFileText(file);
        accepted.push({
          id: `${file.name}:${file.size}:${file.lastModified}`,
          title: file.name,
          text,
          provider: "Uploaded document",
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "could not be read";
        failed.push(`${file.name}: ${reason}`);
      }
    }

    if (accepted.length) {
      setUploadArtifacts((current) => {
        const existingIds = new Set(current.map((artifact) => artifact.id));
        return [...current, ...accepted.filter((artifact) => !existingIds.has(artifact.id))];
      });
      setSourceProvider("Uploaded document");
      setErrors((current) => ({ ...current, sourceTitle: undefined, sourceText: undefined }));
      setNotice("");
    }
    if (failed.length) {
      setAnalysisError(`${failed.length} file${failed.length === 1 ? "" : "s"} could not be added. ${failed.join(" | ")}`);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeQueuedUpload(id: string) {
    setUploadArtifacts((current) => current.filter((artifact) => artifact.id !== id));
    setAnalysisError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function connectAndPickDrive() {
    setAnalysisError("");
    if (!googleDriveConfigured()) {
      setAnalysisError("Google Drive is not configured on this deployment yet.");
      return;
    }
    try {
      let token = googleToken;
      if (!token) {
        const connected = await connectGoogleDrive();
        token = connected.accessToken;
        setGoogleToken(token);
        saveIdentity(connected.identity);
        setIdentityState(connected.identity);
      }
      const picked = await pickGoogleDriveFile(token);
      if (!picked) return;
      const file = await readGoogleDriveFile(token, picked);
      setSourceTitle(file.title);
      setSourceText(file.text);
      setSourceProvider("Google Drive");
      setMode("drive");
      setErrors((current) => ({ ...current, sourceTitle: undefined, sourceText: undefined }));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Google Drive connection failed.");
    }
  }

  async function reconstruct() {
    if (!validateRole() || !validateEvidence()) return;
    setAnalysisError("");
    setAnalysisPhase(0);
    const interval = window.setInterval(() => setAnalysisPhase((current) => Math.min(current + 1, ANALYSIS_PHASES.length - 1)), 850);

    try {
      const transition = blankTransition({
        person: person.trim(),
        role: role.trim(),
        department: department.trim(),
        successor: successor.trim(),
        targetDate: formattedDate,
        type: transitionType,
      });
      const pending: PendingEvidence[] = mode === "upload"
        ? uploadArtifacts
        : [{ id: "single-source", title: sourceTitle.trim(), text: sourceText.trim(), provider: sourceProvider }];

      const results: Array<{ result: ReconstructionResult; usedModel: boolean; evidence: PendingEvidence }> = [];
      for (const evidence of pending) {
        const response = await fetch("/api/reconstruct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transition: {
              person: transition.person,
              role: transition.role,
              department: transition.department,
              successor: transition.successor,
              targetDate: transition.targetDate,
            },
            source: {
              title: evidence.title,
              kind: "document",
              provider: evidence.provider,
              text: evidence.text,
            },
          }),
        });
        const payload = (await response.json()) as { result?: ReconstructionResult; usedModel?: boolean; error?: string };
        if (!response.ok || !payload.result) throw new Error(payload.error || `Understudy could not analyse ${evidence.title}.`);
        results.push({ result: payload.result, usedModel: Boolean(payload.usedModel), evidence });
      }

      const first = results[0]?.result;
      if (!first) throw new Error("Understudy did not receive any usable evidence.");
      const multiple = results.length > 1;
      const combinedSources = results.map((item) => item.result.source);
      const combinedProjects = mergeUnique(results.flatMap((item) => item.result.projects), (item) => item.name);
      const combinedRisks = mergeUnique(results.flatMap((item) => item.result.risks), (item) => item.title, 16);
      const combinedGaps = mergeUnique(results.flatMap((item) => item.result.gaps), (item) => item.question, 20);
      const readiness = multiple ? transition.readiness : first.readiness;
      const nextTransition = {
        ...transition,
        summary: multiple
          ? `Initial reconstruction from ${results.length} separate evidence sources. Add anything else you have in the workspace, then finish evidence collection to run the whole-role synthesis.`
          : first.summary,
        readiness,
        metrics: multiple ? transition.metrics : first.metrics,
        sources: combinedSources,
        projects: combinedProjects,
        risks: combinedRisks,
        gaps: combinedGaps,
        status: multiple
          ? ("Needs attention" as const)
          : readiness >= 80
            ? ("Ready for review" as const)
            : readiness >= 55
              ? ("In progress" as const)
              : ("Needs attention" as const),
      };
      const nextWorkspace = createWorkspace(nextTransition);
      for (const item of results) nextWorkspace.sourceBodies[item.result.source.id] = item.evidence.text;
      saveWorkspace(nextWorkspace);
      setWorkspace(nextWorkspace);
      setExisting(nextWorkspace);
      setUsedModel(results.every((item) => item.usedModel));
      setErrors({});
      setNotice("");
      setStep("review");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Something went wrong while analysing the evidence.");
    } finally {
      window.clearInterval(interval);
      setAnalysisPhase(-1);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white">U</span>
            Understudy
          </Link>
          {existing && (
            <button onClick={() => leaveDraft(() => window.location.assign("/workspace"))} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover hover:text-foreground">
              Open workspace
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <Progress step={step} />

        {step === "welcome" && (
          <div className="mx-auto max-w-4xl">
            <div className="max-w-3xl">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Evidence → understanding → handoff</p>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.08] tracking-[-0.055em] sm:text-[52px]">Hand over the work, not just the documents.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted">Understudy reads the real artifacts behind a role, reconstructs what the person owns and why decisions happened, then interviews them only about context the evidence cannot explain.</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => setStep("role")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">Start with real work <IconChevronRight /></button>
              <Link href="/transitions/maya-okafor" className="h-11 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted hover:bg-card-hover">Explore demo</Link>
            </div>
          </div>
        )}

        {step === "role" && (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section>
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Step 1</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Whose work is changing hands?</h1>
                <p className="mt-2 text-sm leading-6 text-muted">Set the handoff boundary first. If anything required is missing, Understudy will tell you exactly what needs attention.</p>
              </div>
              {notice && <div aria-live="polite" className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">{notice}</div>}
              <div className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
                <Field label="Person handing over" error={errors.person} hint="The current owner of the work.">
                  <input ref={refs.person} value={person} onChange={(e) => { setPerson(e.target.value); clearError("person"); }} placeholder="e.g. Jude Akede" className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-faint ${errors.person ? "border-danger" : "border-border focus:border-border-strong"}`} />
                </Field>
                <Field label="Role" error={errors.role} hint="Used to interpret responsibilities and tailor later questions.">
                  <input ref={refs.role} value={role} onChange={(e) => { setRole(e.target.value); clearError("role"); }} placeholder="e.g. Product Manager" className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-faint ${errors.role ? "border-danger" : "border-border focus:border-border-strong"}`} />
                </Field>
                <Field label="Team / department" error={errors.department}>
                  <input ref={refs.department} value={department} onChange={(e) => { setDepartment(e.target.value); clearError("department"); }} placeholder="e.g. Product" className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-faint ${errors.department ? "border-danger" : "border-border focus:border-border-strong"}`} />
                </Field>
                <Field label="Next owner" error={errors.successor} hint="Use a team name if no named successor exists yet.">
                  <input ref={refs.successor} value={successor} onChange={(e) => { setSuccessor(e.target.value); clearError("successor"); }} placeholder="e.g. Product team" className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-faint ${errors.successor ? "border-danger" : "border-border focus:border-border-strong"}`} />
                </Field>
                <Field label="Transition type">
                  <select value={transitionType} onChange={(e) => setTransitionType(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-muted outline-none focus:border-border-strong">
                    <option>Role transition</option><option>Departure</option><option>Internal transfer</option><option>Project handoff</option><option>Temporary coverage</option>
                  </select>
                </Field>
                <Field label="Target handoff date" error={errors.targetDate}>
                  <input ref={refs.targetDate} type="date" value={targetDate} onChange={(e) => { setTargetDate(e.target.value); clearError("targetDate"); }} className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm text-muted outline-none ${errors.targetDate ? "border-danger" : "border-border focus:border-border-strong"}`} />
                </Field>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => leaveDraft(() => setStep("welcome"))} className="text-sm text-subtle hover:text-muted">Back</button>
                <button onClick={moveToEvidence} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Add first evidence <IconChevronRight /></button>
              </div>
            </section>
            <ContextCard step="role" sourceTitle={sourceTitle} />
          </div>
        )}

        {step === "evidence" && (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section>
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Step 2</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Add real work artifacts.</h1>
                <p className="mt-2 text-sm leading-6 text-muted">Start with one file or select several at once. Each artifact stays separate and traceable; you can add more evidence later before finishing collection.</p>
              </div>
              {notice && <div aria-live="polite" className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-muted">{notice}</div>}
              <div className="grid gap-4 sm:grid-cols-3">
                {([[
                  "paste", "Paste text", "PRD, spec, notes"
                ], ["upload", "Upload file", SUPPORTED_UPLOAD_LABEL], ["drive", "Google Drive", googleDriveConfigured() ? "Choose a file" : "Not configured"]] as const).map(([key, label, detail]) => (
                  <button key={key} onClick={() => setMode(key)} className={`rounded-xl border p-4 text-left ${mode === key ? "border-border-strong bg-card-hover" : "border-border bg-card hover:bg-card-hover"}`}>
                    <p className="text-sm font-medium">{label}</p><p className="mt-1 text-xs text-subtle">{detail}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-border bg-card p-5">
                {mode === "paste" && (
                  <>
                    <Field label="Source title" error={errors.sourceTitle}>
                      <input ref={refs.sourceTitle} value={sourceTitle} onChange={(e) => { setSourceTitle(e.target.value); setSourceProvider("Pasted evidence"); clearError("sourceTitle"); }} placeholder="e.g. Teams & Permissions PRD" className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-faint ${errors.sourceTitle ? "border-danger" : "border-border focus:border-border-strong"}`} />
                    </Field>
                    <div className="mt-4">
                      <Field label="Source content" error={errors.sourceText}>
                        <textarea ref={refs.sourceText} value={sourceText} onChange={(e) => { setSourceText(e.target.value); setSourceProvider("Pasted evidence"); clearError("sourceText"); }} rows={12} placeholder="Paste the artifact exactly as it exists…" className={`mt-2 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-6 outline-none placeholder:text-faint ${errors.sourceText ? "border-danger" : "border-border focus:border-border-strong"}`} />
                      </Field>
                    </div>
                  </>
                )}
                {mode === "upload" && (
                  <div>
                    <button onClick={() => fileInput.current?.click()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-6 text-center">
                      <IconUpload className="text-muted" /><p className="mt-4 text-sm font-medium">Choose one or more work files</p><p className="mt-1 text-xs text-subtle">Select several files in one pick, or come back and add another batch. {SUPPORTED_UPLOAD_LABEL}</p>
                    </button>
                    <input ref={fileInput} type="file" multiple accept={SUPPORTED_UPLOAD_ACCEPT} className="hidden" onChange={(e) => void readUploads(e.target.files ?? undefined)} />
                    {uploadArtifacts.length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                          <p className="text-sm font-medium">{uploadArtifacts.length} file{uploadArtifacts.length === 1 ? "" : "s"} queued</p>
                          <button type="button" onClick={() => fileInput.current?.click()} className="text-xs font-medium text-accent hover:text-accent-hover">Add more</button>
                        </div>
                        <div className="divide-y divide-border">
                          {uploadArtifacts.map((artifact) => (
                            <div key={artifact.id} className="flex items-center gap-3 px-3 py-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"><IconFile className="h-4 w-4 text-muted" /></span>
                              <p className="min-w-0 flex-1 truncate text-sm text-muted">{artifact.title}</p>
                              <button type="button" onClick={() => removeQueuedUpload(artifact.id)} className="text-xs text-subtle hover:text-danger">Remove</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {errors.sourceText && <p className="mt-2 text-xs text-danger">{errors.sourceText}</p>}
                  </div>
                )}
                {mode === "drive" && (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background font-semibold">G</div>
                    <h2 className="mt-4 text-sm font-medium">Choose a file from Google Drive</h2>
                    <p className="mt-2 max-w-md text-xs leading-5 text-subtle">You choose the exact file Understudy may read. It does not scan your Drive.</p>
                    <button onClick={() => void connectAndPickDrive()} className="mt-5 h-10 rounded-lg border border-border-strong bg-card-hover px-4 text-sm font-medium">{identity?.provider === "google" ? "Choose Drive file" : "Connect Google & choose file"}</button>
                    {sourceProvider === "Google Drive" && sourceTitle && <p className="mt-3 text-sm text-ok">Ready: {sourceTitle}</p>}
                  </div>
                )}

                {analysisError && <div className="mt-4 rounded-lg border border-danger/25 bg-danger/10 px-3 py-3 text-sm leading-5 text-danger">{analysisError}</div>}
                {analysisPhase >= 0 ? (
                  <div className="mt-5 rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-medium"><IconSpark className="animate-pulse" /> Reconstructing the role</div>
                    <div className="mt-3 space-y-2">{ANALYSIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-2 text-xs ${index <= analysisPhase ? "text-muted" : "text-faint"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < analysisPhase ? "bg-ok" : index === analysisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div>
                  </div>
                ) : (
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <button onClick={() => setStep("role")} className="text-sm text-subtle hover:text-muted">Back</button>
                    <button onClick={() => void reconstruct()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconSpark /> {mode === "upload" && uploadArtifacts.length > 1 ? `Reconstruct ${uploadArtifacts.length} sources` : "Reconstruct this work"}</button>
                  </div>
                )}
              </div>
            </section>
            <ContextCard step="evidence" sourceTitle={sourceTitle} />
          </div>
        )}

        {step === "review" && workspace && (
          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section>
              <div className="rounded-xl border border-border-strong bg-card p-6">
                <div className="flex items-center gap-2 text-sm text-ok"><IconCheck /> First reconstruction complete</div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">Understudy has a starting model, not a finished handoff.</h1>
                <p className="mt-3 text-sm leading-6 text-muted">{workspace.transition.summary}</p>
                <div className="mt-4 rounded-lg border border-border bg-background px-3 py-3 text-xs leading-5 text-subtle">{usedModel ? "Analysed with Gemini. Review the reconstruction before treating any claim as verified knowledge." : "Gemini was unavailable, so the deterministic fallback was used. Review every finding carefully."}</div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-subtle">Work mapped</p><p className="mt-2 text-2xl font-semibold">{workspace.transition.projects.length}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-subtle">Continuity risks</p><p className="mt-2 text-2xl font-semibold">{workspace.transition.risks.length}</p></div>
                <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-subtle">Open questions</p><p className="mt-2 text-2xl font-semibold">{workspace.transition.gaps.length}</p></div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => window.location.assign("/workspace")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Open workspace <IconChevronRight /></button>
                <button onClick={() => setStep("evidence")} className="h-11 rounded-lg border border-border bg-card px-4 text-sm text-muted">Try a different first source</button>
              </div>
            </section>
            <ContextCard step="review" sourceTitle={sourceTitle} />
          </div>
        )}
      </main>
    </div>
  );
}
