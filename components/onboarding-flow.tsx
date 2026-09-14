"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
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

const ANALYSIS_PHASES = [
  "Reading the source",
  "Mapping responsibilities and active work",
  "Recovering decisions and rationale",
  "Finding continuity risks",
  "Turning unknowns into interview questions",
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        {label}
        {hint && (
          <span
            className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[9px] text-subtle"
            aria-label={hint}
          >
            ?
            <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-56 -translate-x-1/2 rounded-lg border border-border bg-[#15161a] p-2.5 text-left text-[9.5px] font-normal leading-4 text-muted shadow-2xl group-hover:block">
              {hint}
            </span>
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Progress({ step }: { step: Step }) {
  const index = step === "role" ? 0 : step === "evidence" ? 1 : step === "review" ? 2 : -1;
  if (index < 0) return null;
  return (
    <div className="mx-auto mb-8 flex max-w-md items-center">
      {["Transition", "Evidence", "Review"].map((label, item) => (
        <div key={label} className={`flex items-center ${item < 2 ? "flex-1" : ""}`}>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-semibold ${
                item < index
                  ? "border-accent bg-accent text-white"
                  : item === index
                    ? "border-[#8d96ff] bg-accent-soft text-[#c4c8ff]"
                    : "border-border bg-card text-faint"
              }`}
            >
              {item < index ? <IconCheck className="h-3 w-3" /> : item + 1}
            </span>
            <span className={`hidden text-[9.5px] sm:block ${item <= index ? "text-muted" : "text-faint"}`}>
              {label}
            </span>
          </div>
          {item < 2 && <span className={`mx-3 h-px flex-1 ${item < index ? "bg-accent" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

export function OnboardingFlow() {
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
  const [analysisPhase, setAnalysisPhase] = useState(-1);
  const [analysisError, setAnalysisError] = useState("");
  const [usedModel, setUsedModel] = useState(false);
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [googleToken, setGoogleToken] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIdentityState(getIdentity());
    setExisting(getCurrentWorkspace());
  }, []);

  const roleReady = person.trim() && role.trim() && department.trim() && successor.trim() && targetDate;
  const evidenceReady = sourceTitle.trim() && sourceText.trim().length >= 40;
  const formattedDate = useMemo(() => {
    if (!targetDate) return "";
    const parsed = new Date(`${targetDate}T12:00:00`);
    return Number.isNaN(parsed.valueOf())
      ? targetDate
      : parsed.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }, [targetDate]);

  async function readUpload(file?: File) {
    if (!file) return;
    const allowed = [".txt", ".md", ".json", ".csv"];
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!allowed.includes(extension)) {
      setAnalysisError("For this build, upload TXT, Markdown, JSON, or CSV. Google Docs can be selected from Drive. PDF/DOCX parsing is the next source format to add.");
      return;
    }
    const text = await file.text();
    setSourceTitle(file.name);
    setSourceText(text.slice(0, 60_000));
    setSourceProvider("Uploaded document");
    setAnalysisError("");
  }

  async function connectAndPickDrive() {
    setAnalysisError("");
    if (!googleDriveConfigured()) {
      setAnalysisError("Google Drive is coded but not configured on this deployment yet. Add the Google OAuth client ID and browser API key in Cloudflare, then this button becomes live.");
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
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Google Drive connection failed.");
    }
  }

  async function reconstruct() {
    if (!roleReady || !evidenceReady) return;
    setAnalysisError("");
    setAnalysisPhase(0);
    const interval = window.setInterval(() => {
      setAnalysisPhase((current) => Math.min(current + 1, ANALYSIS_PHASES.length - 1));
    }, 850);

    try {
      const transition = blankTransition({
        person: person.trim(),
        role: role.trim(),
        department: department.trim(),
        successor: successor.trim(),
        targetDate: formattedDate,
        type: transitionType,
      });
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
            title: sourceTitle.trim(),
            kind: "document",
            provider: sourceProvider,
            text: sourceText.trim(),
          },
        }),
      });
      const payload = (await response.json()) as {
        result?: ReconstructionResult;
        usedModel?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Understudy could not analyse this source.");

      const result = payload.result;
      const nextTransition = {
        ...transition,
        summary: result.summary,
        readiness: result.readiness,
        metrics: result.metrics,
        sources: [result.source],
        projects: result.projects,
        risks: result.risks,
        gaps: result.gaps,
        status: result.readiness >= 80 ? ("Ready for review" as const) : result.readiness >= 55 ? ("In progress" as const) : ("Needs attention" as const),
      };
      const nextWorkspace = createWorkspace(nextTransition);
      nextWorkspace.sourceBodies[result.source.id] = sourceText.trim();
      saveWorkspace(nextWorkspace);
      setWorkspace(nextWorkspace);
      setExisting(nextWorkspace);
      setUsedModel(Boolean(payload.usedModel));
      setStep("review");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Something went wrong while analysing the source.");
    } finally {
      window.clearInterval(interval);
      setAnalysisPhase(-1);
    }
  }

  function openWorkspace() {
    window.location.assign("/workspace?tour=1");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 text-[14px] font-medium tracking-[-0.02em]">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-[11px] font-semibold text-white">U</span>
            Understudy
          </Link>
          <div className="flex items-center gap-3">
            {identity?.provider === "google" && (
              <span className="hidden text-[10.5px] text-subtle sm:block">{identity.email || identity.name}</span>
            )}
            {existing && (
              <button onClick={() => window.location.assign("/workspace")} className="rounded-lg border border-border bg-card px-3 py-2 text-[10.5px] text-muted hover:bg-card-hover hover:text-foreground">
                Open workspace
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <Progress step={step} />

        {step === "welcome" && (
          <div className="mx-auto max-w-4xl">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-[#5e6ad2]/30 bg-accent-soft px-2.5 py-1 text-[9.5px] font-medium text-[#b9beff]">Evidence → understanding → handoff</span>
              <h1 className="mt-5 text-[38px] font-semibold leading-[1.08] tracking-[-0.055em] sm:text-[52px]">
                Hand over the work, not just the documents.
              </h1>
              <p className="mt-5 max-w-2xl text-[14px] leading-6 text-muted">
                Understudy reads the real artifacts behind a role, reconstructs what the person owns and why decisions happened, then interviews them only about the context the evidence cannot explain.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {[
                ["01", "Add real evidence", "Start with a PRD, project note, exported AI context, or a file you choose from Google Drive."],
                ["02", "Watch the role reconstruct", "Understudy maps active work, ownership, decisions, risks, and missing rationale from the source."],
                ["03", "Close only the real gaps", "The remaining unknowns become an adaptive interview and a successor-ready handoff."],
              ].map(([number, title, body]) => (
                <div key={number} className="rounded-xl border border-border bg-card p-5">
                  <span className="font-mono text-[9px] text-[#aeb4ff]">{number}</span>
                  <h2 className="mt-5 text-[13px] font-medium">{title}</h2>
                  <p className="mt-2 text-[10.5px] leading-5 text-subtle">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => setStep("role")} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[12px] font-medium text-white hover:bg-accent-hover">
                Start with real work <IconChevronRight />
              </button>
              <Link href="/transitions/maya-okafor" className="h-10 rounded-lg border border-border bg-card px-4 py-2.5 text-[11px] text-muted hover:bg-card-hover hover:text-foreground">
                Explore the demo instead
              </Link>
            </div>
            <p className="mt-4 text-[9.5px] text-faint">Your personal trial data stays in your browser in this build. Google-connected workspaces are namespaced to the connected account; cloud persistence is the next infrastructure layer.</p>
          </div>
        )}

        {step === "role" && (
          <div className="mx-auto max-w-2xl">
            <div className="mb-7">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#aeb4ff]">Step 1</p>
              <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.045em]">Whose work is changing hands?</h1>
              <p className="mt-2 text-[11.5px] leading-5 text-muted">This gives Understudy enough context to interpret the evidence correctly. Nothing is inferred from fake demo data.</p>
            </div>
            <div className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
              <Field label="Person handing over" hint="The current owner of the work. This can be you, a teammate leaving, or someone moving roles.">
                <input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="e.g. Jude Akede" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] outline-none placeholder:text-faint focus:border-[#6f79e9]" />
              </Field>
              <Field label="Role" hint="Understudy uses the role to interpret responsibilities and tailor interview questions.">
                <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Product Manager" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] outline-none placeholder:text-faint focus:border-[#6f79e9]" />
              </Field>
              <Field label="Team / department">
                <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Product" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] outline-none placeholder:text-faint focus:border-[#6f79e9]" />
              </Field>
              <Field label="Next owner" hint="Who should be able to continue the work after the handoff? Use a team name if there is no named successor yet.">
                <input value={successor} onChange={(event) => setSuccessor(event.target.value)} placeholder="e.g. Product team" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] outline-none placeholder:text-faint focus:border-[#6f79e9]" />
              </Field>
              <Field label="Transition type">
                <select value={transitionType} onChange={(event) => setTransitionType(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] text-muted outline-none focus:border-[#6f79e9]">
                  <option>Role transition</option>
                  <option>Departure</option>
                  <option>Internal transfer</option>
                  <option>Project handoff</option>
                  <option>Temporary coverage</option>
                </select>
              </Field>
              <Field label="Target handoff date">
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] text-muted outline-none focus:border-[#6f79e9]" />
              </Field>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setStep("welcome")} className="text-[10.5px] text-subtle hover:text-muted">Back</button>
              <button disabled={!roleReady} onClick={() => setStep("evidence")} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-35">
                Add first evidence <IconChevronRight />
              </button>
            </div>
          </div>
        )}

        {step === "evidence" && (
          <div className="mx-auto max-w-4xl">
            <div className="mb-7 max-w-2xl">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#aeb4ff]">Step 2</p>
              <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.045em]">Give Understudy one real artifact.</h1>
              <p className="mt-2 text-[11.5px] leading-5 text-muted">A PRD is ideal for the first run. Understudy will show exactly what it can and cannot reconstruct from that source before asking for anything else.</p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                {([
                  ["paste", "Paste a PRD", "Fastest"],
                  ["upload", "Upload text file", "TXT / MD / JSON / CSV"],
                  ["drive", "Google Drive", googleDriveConfigured() ? "Choose a file" : "Needs one-time setup"],
                ] as const).map(([key, label, note]) => (
                  <button key={key} onClick={() => setMode(key)} className={`w-full rounded-lg border p-3 text-left transition-colors ${mode === key ? "border-[#6570df]/50 bg-accent-soft" : "border-border bg-card hover:bg-card-hover"}`}>
                    <p className="text-[10.5px] font-medium">{label}</p>
                    <p className="mt-1 text-[9px] text-subtle">{note}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                {mode === "paste" && (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="text-muted" /></div>
                      <div>
                        <h2 className="text-[12px] font-medium">Paste the artifact exactly as it exists</h2>
                        <p className="mt-1 text-[9.5px] leading-4 text-subtle">Do not rewrite it for Understudy. The product should learn from normal work artifacts.</p>
                      </div>
                    </div>
                    <input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title, e.g. Teams & Permissions PRD" className="mt-5 h-10 w-full rounded-lg border border-border bg-background px-3 text-[11px] outline-none placeholder:text-faint focus:border-[#6f79e9]" />
                    <textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={12} placeholder="Paste a real PRD, spec, project brief, decision log, or work note…" className="mt-3 w-full resize-y rounded-lg border border-border bg-background p-3 text-[10.5px] leading-5 outline-none placeholder:text-faint focus:border-[#6f79e9]" />
                  </>
                )}

                {mode === "upload" && (
                  <div>
                    <button onClick={() => fileInput.current?.click()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-6 text-center hover:border-[#6570df]/60">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card"><IconUpload className="text-muted" /></span>
                      <p className="mt-4 text-[11.5px] font-medium">Choose a real work file</p>
                      <p className="mt-1 max-w-sm text-[9.5px] leading-4 text-subtle">TXT, Markdown, JSON, or CSV up to the current 60k-character analysis limit.</p>
                    </button>
                    <input ref={fileInput} type="file" accept=".txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv" className="hidden" onChange={(event) => void readUpload(event.target.files?.[0])} />
                    {sourceTitle && <p className="mt-3 text-[10px] text-muted">Selected: {sourceTitle} · {sourceText.length.toLocaleString()} characters</p>}
                  </div>
                )}

                {mode === "drive" && (
                  <div className="flex min-h-56 flex-col items-center justify-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-[15px] font-semibold">G</div>
                    <h2 className="mt-4 text-[12px] font-medium">Choose a file from your Google Drive</h2>
                    <p className="mt-2 max-w-md text-[9.5px] leading-4 text-subtle">Understudy requests Google&apos;s narrow <span className="text-muted">drive.file</span> permission. You choose the exact file it may read; it does not scan your Drive.</p>
                    <button onClick={() => void connectAndPickDrive()} className="mt-5 h-9 rounded-lg border border-border-strong bg-card-hover px-4 text-[10.5px] font-medium hover:bg-surface-3">{identity?.provider === "google" ? "Choose Drive file" : "Connect Google & choose file"}</button>
                    {sourceProvider === "Google Drive" && sourceTitle && <p className="mt-3 text-[10px] text-[#8fd0a5]">Ready: {sourceTitle}</p>}
                  </div>
                )}

                {analysisError && <div className="mt-4 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-[9.5px] leading-4 text-[#f29ba4]">{analysisError}</div>}

                {analysisPhase >= 0 ? (
                  <div className="mt-5 rounded-lg border border-[#5e6ad2]/30 bg-accent-soft p-4">
                    <div className="flex items-center gap-2 text-[10.5px] font-medium"><IconSpark className="animate-pulse text-[#b9beff]" /> Reconstructing the role from this evidence</div>
                    <div className="mt-3 space-y-2">
                      {ANALYSIS_PHASES.map((phase, index) => (
                        <div key={phase} className={`flex items-center gap-2 text-[9.5px] ${index <= analysisPhase ? "text-muted" : "text-faint"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${index < analysisPhase ? "bg-ok" : index === analysisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />
                          {phase}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <button onClick={() => setStep("role")} className="text-[10.5px] text-subtle hover:text-muted">Back</button>
                    <button disabled={!evidenceReady} onClick={() => void reconstruct()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-35">
                      <IconSpark /> Reconstruct this work
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "review" && workspace && (
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-[#5e6ad2]/35 bg-[rgba(94,106,210,0.06)] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-[#b9beff]"><IconCheck /> First reconstruction complete</div>
                  <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.045em]">Understudy now has something real to work with.</h1>
                  <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">{workspace.transition.summary}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-muted">{workspace.transition.readiness}% readiness</span>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-background px-3 py-2.5 text-[9.5px] leading-4 text-subtle">
                {usedModel ? "Analysed with Gemini. The findings are evidence-derived but still need human verification." : "Gemini was unavailable, so Understudy used the deterministic fallback. The workflow still works, but AI reconstruction is not active."}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Work mapped</p>
                <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">{workspace.transition.projects.length}</p>
                <p className="mt-2 text-[9.5px] leading-4 text-muted">{workspace.transition.projects[0]?.name || "No work area confidently identified"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Continuity risks</p>
                <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">{workspace.transition.risks.length}</p>
                <p className="mt-2 text-[9.5px] leading-4 text-muted">{workspace.transition.risks[0]?.title || "No material risk detected yet"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[9px] uppercase tracking-[0.1em] text-subtle">Questions worth asking</p>
                <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em]">{workspace.transition.gaps.length}</p>
                <p className="mt-2 text-[9.5px] leading-4 text-muted">{workspace.transition.gaps[0]?.question || "No gap detected yet"}</p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={openWorkspace} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-[11.5px] font-medium text-white hover:bg-accent-hover">Open the guided workspace <IconChevronRight /></button>
              <button onClick={() => setStep("evidence")} className="h-10 rounded-lg border border-border bg-card px-4 text-[10.5px] text-muted hover:bg-card-hover">Try a different source</button>
            </div>
            <p className="mt-4 text-[9.5px] text-faint">The workspace will now show you what to verify next instead of dropping you into six unexplained tabs.</p>
          </div>
        )}
      </main>
    </div>
  );
}
