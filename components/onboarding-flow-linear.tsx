"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import { extractFileText, SUPPORTED_UPLOAD_ACCEPT, SUPPORTED_UPLOAD_LABEL } from "@/lib/file-extraction";
import { modelStatusCopy, type ModelStatus } from "@/lib/model-status";
import {
  blankTransition,
  createWorkspace,
  saveIdentity,
  saveWorkspace,
} from "@/lib/personal-workspace";
import {
  connectGoogleDrive,
  pickGoogleDriveFile,
  readGoogleDriveFile,
} from "@/lib/google-drive";
import { CloudAccountControl } from "./cloud-account-control";
import { IconCheck, IconChevronRight, IconFile, IconSpark, IconUpload } from "./icons";

type Step = "welcome" | "role" | "evidence" | "review";
type Mode = "upload" | "paste" | "drive";
type PendingEvidence = { id: string; title: string; text: string; provider: string };
type ReadingState = { current: number; total: number; name: string } | null;

type RoleErrors = Partial<Record<"person" | "role" | "department" | "successor" | "targetDate", string>>;

const STEP_LABELS = ["Transition", "Evidence", "Review"];

function mergeUnique<T>(items: T[], key: (item: T) => string, limit = 20) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item).trim().toLowerCase();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

export function OnboardingFlowLinear() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("welcome");
  const [person, setPerson] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [successor, setSuccessor] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [transitionType, setTransitionType] = useState("Role transition");
  const [errors, setErrors] = useState<RoleErrors>({});
  const [mode, setMode] = useState<Mode>("upload");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceProvider, setSourceProvider] = useState("Pasted evidence");
  const [queued, setQueued] = useState<PendingEvidence[]>([]);
  const [reading, setReading] = useState<ReadingState>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [googleToken, setGoogleToken] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const stepIndex = step === "role" ? 0 : step === "evidence" ? 1 : step === "review" ? 2 : -1;
  const formattedDate = useMemo(() => {
    if (!targetDate) return "";
    const parsed = new Date(`${targetDate}T12:00:00`);
    return Number.isNaN(parsed.valueOf()) ? targetDate : parsed.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }, [targetDate]);

  function validateRole() {
    const next: RoleErrors = {};
    if (!person.trim()) next.person = "Who is handing over this work?";
    if (!role.trim()) next.role = "What role are they handing over?";
    if (!department.trim()) next.department = "Which team owns this work?";
    if (!successor.trim()) next.successor = "Who or which team is taking over?";
    if (!targetDate) next.targetDate = "Choose the target handoff date.";
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("Complete the highlighted details before adding evidence.");
      return false;
    }
    setMessage("");
    return true;
  }

  async function readFiles(files?: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files);
    setMessage("");
    setReading({ current: 0, total: picked.length, name: picked[0]?.name ?? "" });
    const accepted: PendingEvidence[] = [];
    const failed: string[] = [];
    try {
      for (let index = 0; index < picked.length; index += 1) {
        const file = picked[index];
        setReading({ current: index + 1, total: picked.length, name: file.name });
        try {
          const text = await extractFileText(file);
          accepted.push({ id: `${file.name}:${file.size}:${file.lastModified}`, title: file.name, text, provider: "Uploaded document" });
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : "could not be read"}`);
        }
      }
      setQueued((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...accepted.filter((item) => !existing.has(item.id))];
      });
      if (failed.length) setMessage(`${failed.length} file${failed.length === 1 ? "" : "s"} could not be read. ${failed.join(" · ")}`);
    } finally {
      setReading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function pickDrive() {
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

  async function reconstruct() {
    if (!validateRole() || busy) return;
    const pending: PendingEvidence[] = mode === "paste"
      ? sourceTitle.trim() && sourceText.trim()
        ? [{ id: crypto.randomUUID(), title: sourceTitle.trim(), text: sourceText.trim(), provider: sourceProvider }]
        : []
      : queued;
    if (!pending.length) {
      setMessage(mode === "paste" ? "Add a source title and some source text first." : "Choose at least one work artifact first.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const transition = blankTransition({
        person: person.trim(),
        role: role.trim(),
        department: department.trim(),
        successor: successor.trim(),
        targetDate: formattedDate,
        type: transitionType,
      });

      const results: Array<{ result: ReconstructionResult; evidence: PendingEvidence; usedModel: boolean; modelStatus?: ModelStatus }> = [];
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
            source: { title: evidence.title, text: evidence.text, provider: evidence.provider, kind: "document" },
          }),
        });
        const payload = (await response.json()) as { result?: ReconstructionResult; usedModel?: boolean; modelStatus?: ModelStatus; error?: string };
        if (!response.ok || !payload.result) throw new Error(payload.error || `Understudy could not analyse ${evidence.title}.`);
        results.push({ result: payload.result, evidence, usedModel: Boolean(payload.usedModel), modelStatus: payload.modelStatus });
      }

      const first = results[0]?.result;
      if (!first) throw new Error("No usable evidence was produced.");
      const multiple = results.length > 1;
      const combined = {
        ...transition,
        summary: multiple
          ? `Initial reconstruction from ${results.length} separate evidence sources. Continue in the workspace to add anything else, then connect the full evidence set.`
          : first.summary,
        readiness: multiple ? 0 : first.readiness,
        metrics: multiple ? transition.metrics : first.metrics,
        sources: results.map((item) => item.result.source),
        projects: mergeUnique(results.flatMap((item) => item.result.projects), (item) => item.name),
        risks: mergeUnique(results.flatMap((item) => item.result.risks), (item) => item.title, 16),
        gaps: mergeUnique(results.flatMap((item) => item.result.gaps), (item) => item.question, 20),
        status: "Needs attention" as const,
      };
      const next = createWorkspace(combined);
      results.forEach((item) => { next.sourceBodies[item.result.source.id] = item.evidence.text; });
      saveWorkspace(next);
      const fallback = results.find((item) => item.modelStatus?.state === "fallback")?.modelStatus;
      setModelStatus(fallback ?? { state: "ok", retryable: false });
      setWorkspaceReady(true);
      setStep("review");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Understudy could not reconstruct this handoff.");
    } finally {
      setBusy(false);
    }
  }

  const modelCopy = modelStatusCopy(modelStatus);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>Understudy</Link>
          <div className="flex items-center gap-2"><Link href="/handoffs" className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover">My handoffs</Link><CloudAccountControl compact /></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        {stepIndex >= 0 && <div className="mx-auto mb-10 grid max-w-xl grid-cols-3 gap-2">{STEP_LABELS.map((label, index) => <div key={label} className="relative rounded-xl px-3 py-3">{index === stepIndex && <motion.div layoutId="onboarding-step" className="absolute inset-0 rounded-xl border border-border-strong bg-card shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}<div className="relative flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${index < stepIndex ? "border-accent bg-accent text-white" : "border-border-strong bg-background"}`}>{index < stepIndex ? <IconCheck className="h-3.5 w-3.5" /> : index + 1}</span><span className={`text-xs ${index <= stepIndex ? "text-foreground" : "text-faint"}`}>{label}</span></div></div>)}</div>}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -12 }} transition={reducedMotion ? { duration: 0 } : { x: { type: "spring", stiffness: 370, damping: 34 }, opacity: { duration: 0.2 } }}>
            {step === "welcome" && <div className="mx-auto max-w-4xl"><p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Work continuity</p><h1 className="mt-4 max-w-3xl text-[42px] font-semibold leading-[1.06] tracking-[-0.055em] sm:text-[56px]">Hand over the work, not just the documents.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted">Understudy starts with the artifacts that already exist, reconstructs the work, asks only about missing context, then lets the next owner verify the handoff.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setStep("role")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Start a handoff <IconChevronRight /></button><Link href="/handoffs" className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted">My handoffs</Link><Link href="/transitions/maya-okafor" className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm text-muted">Walk through an example</Link></div></div>}

            {step === "role" && <div className="mx-auto max-w-3xl"><p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Step 1</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Whose work is changing hands?</h1><p className="mt-2 text-sm leading-6 text-muted">Set the boundary once. Understudy uses it to interpret the evidence you add next.</p>{message && <div className="mt-5 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-sm text-muted">{message}</div>}<div className="mt-7 grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 sm:p-6">
              {([[
                "Person handing over", person, setPerson, "e.g. Jude Akede", "person"
              ], ["Role", role, setRole, "e.g. Product Manager", "role"], ["Team / department", department, setDepartment, "e.g. Product", "department"], ["Next owner", successor, setSuccessor, "e.g. Product team", "successor"]] as const).map(([label, value, setter, placeholder, key]) => <label key={key} className="block"><span className="text-xs font-medium">{label}</span><input value={value} onChange={(event) => { setter(event.target.value); setErrors((current) => ({ ...current, [key]: undefined })); }} placeholder={placeholder} className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none ${errors[key] ? "border-danger" : "border-border focus:border-border-strong"}`} />{errors[key] && <span className="mt-1 block text-xs text-danger">{errors[key]}</span>}</label>)}
              <label><span className="text-xs font-medium">Transition type</span><select value={transitionType} onChange={(event) => setTransitionType(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option>Role transition</option><option>Departure</option><option>Internal transfer</option><option>Project handoff</option><option>Temporary coverage</option></select></label>
              <label><span className="text-xs font-medium">Target handoff date</span><input type="date" value={targetDate} onChange={(event) => { setTargetDate(event.target.value); setErrors((current) => ({ ...current, targetDate: undefined })); }} className={`mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm ${errors.targetDate ? "border-danger" : "border-border"}`} />{errors.targetDate && <span className="mt-1 block text-xs text-danger">{errors.targetDate}</span>}</label>
            </div><div className="mt-5 flex justify-between"><button onClick={() => setStep("welcome")} className="text-sm text-subtle">Back</button><button onClick={() => { if (validateRole()) setStep("evidence"); }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Add work artifacts <IconChevronRight /></button></div></div>}

            {step === "evidence" && <div className="mx-auto max-w-3xl"><p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Step 2</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Add real work artifacts.</h1><p className="mt-2 text-sm leading-6 text-muted">Choose several files at once if you want. Understudy reads them locally first, keeps them separate, and shows you exactly what is queued before analysis.</p>{message && <div className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">{message}</div>}<div className="mt-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex gap-1 border-b border-border p-2">{(["upload", "paste", "drive"] as Mode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-lg px-3 py-2 text-xs font-medium ${mode === item ? "bg-foreground text-background" : "text-muted hover:bg-background"}`}>{item === "upload" ? "Upload files" : item === "paste" ? "Paste text" : "Google Drive"}</button>)}</div><div className="p-5">
              {mode === "upload" && <><button disabled={Boolean(reading)} onClick={() => fileInput.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background px-6 text-center disabled:cursor-wait"><IconUpload className="text-muted" /><p className="mt-3 text-sm font-medium">Choose one or more work files</p><p className="mt-1 max-w-md text-xs leading-5 text-subtle">{SUPPORTED_UPLOAD_LABEL}. Pick another batch later without replacing these files.</p></button><input ref={fileInput} type="file" multiple accept={SUPPORTED_UPLOAD_ACCEPT} className="hidden" onChange={(event) => void readFiles(event.target.files)} /></>}
              <AnimatePresence>{reading && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3"><motion.span animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-accent/30 border-t-accent" /><div className="min-w-0"><p className="text-sm font-medium">Reading file {reading.current || 1} of {reading.total}</p><p className="truncate text-xs text-subtle">{reading.name}</p></div></motion.div>}</AnimatePresence>
              {mode === "paste" && <div><input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none" /><textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={10} placeholder="Paste the artifact exactly as it exists…" className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none" /></div>}
              {mode === "drive" && <div className="py-10 text-center"><p className="text-sm font-medium">Choose a file from Google Drive</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-subtle">Understudy only receives the exact file you choose.</p><button onClick={() => void pickDrive()} className="mt-4 h-10 rounded-lg border border-border-strong bg-background px-4 text-sm font-medium text-muted">Choose Drive file</button></div>}
              {queued.length > 0 && <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background"><div className="flex items-center justify-between border-b border-border px-3 py-2.5"><p className="text-sm font-medium">{queued.length} file{queued.length === 1 ? "" : "s"} queued</p>{mode === "upload" && <button onClick={() => fileInput.current?.click()} className="text-xs font-medium text-accent">Add more</button>}</div><div className="divide-y divide-border">{queued.map((item) => <div key={item.id} className="flex items-center gap-3 px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card"><IconFile className="h-4 w-4 text-muted" /></span><p className="min-w-0 flex-1 truncate text-sm text-muted">{item.title}</p><button onClick={() => setQueued((current) => current.filter((candidate) => candidate.id !== item.id))} className="text-xs text-subtle hover:text-danger">Remove</button></div>)}</div></div>}
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><button onClick={() => setStep("role")} className="text-sm text-subtle">Back</button><button disabled={busy || Boolean(reading)} onClick={() => void reconstruct()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40">{busy ? "Reconstructing…" : "Build the starting map"}<IconSpark /></button></div>
            </div></div></div>}

            {step === "review" && workspaceReady && <div className="mx-auto max-w-3xl"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck /></span><h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">You have a starting map, not a finished handoff.</h1><p className="mt-3 text-sm leading-6 text-muted">Open the workspace to add anything else, connect the full evidence set, review Understudy’s interpretation, and fill only the context the evidence could not answer.</p><div className={`mt-6 rounded-xl border p-4 ${modelStatus?.state === "fallback" ? "border-warning/30 bg-warning/5" : "border-border bg-card"}`}><p className="text-sm font-medium">{modelCopy.title}</p><p className="mt-1 text-xs leading-5 text-subtle">{modelCopy.body}</p></div><div className="mt-7 flex flex-wrap gap-3"><button onClick={() => window.location.assign("/workspace")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white">Continue the handoff <IconChevronRight /></button><Link href="/handoffs" className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm text-muted">My handoffs</Link></div></div>}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
