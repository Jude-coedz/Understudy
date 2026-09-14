"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReconstructionResult } from "@/lib/v2-reconstruction";
import {
  getCurrentWorkspace,
  getIdentity,
  saveIdentity,
  saveWorkspace,
  type PersonalWorkspace,
} from "@/lib/personal-workspace";
import {
  connectGoogleDrive,
  googleDriveConfigured,
  pickGoogleDriveFile,
  readGoogleDriveFile,
} from "@/lib/google-drive";
import type { EvidenceKind, SourceItem, Transition } from "@/data/v2-demo";
import {
  IconAlert,
  IconCheck,
  IconChevronRight,
  IconFile,
  IconMessage,
  IconSpark,
  IconUpload,
} from "./icons";

type Stage = "sources" | "map" | "interview" | "handoff";
type SourceMode = "paste" | "upload" | "drive";

const STAGES: Array<{ key: Stage; label: string; help: string }> = [
  { key: "sources", label: "1. Sources", help: "Add the real artifacts where the work is documented. Understudy keeps every finding linked to its evidence." },
  { key: "map", label: "2. Reconstruction", help: "Review what Understudy believes this person owns, the risks it found, and where evidence is weak." },
  { key: "interview", label: "3. Interview", help: "Answer only the questions the existing evidence could not resolve. Each answer becomes new evidence." },
  { key: "handoff", label: "4. Handoff", help: "Turn the verified reconstruction into a successor-readable briefing with open questions kept visible." },
];

const ANALYSIS_PHASES = ["Reading evidence", "Mapping work", "Recovering decisions", "Finding gaps"];

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-border text-[9px] text-subtle" aria-label={text}>
      ?
      <span className="pointer-events-none absolute left-1/2 top-6 z-50 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-[#15161a] p-2.5 text-left text-[9.5px] font-normal leading-4 text-muted shadow-2xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

function mergeUnique<T>(existing: T[], incoming: T[], key: (item: T) => string, limit = 10) {
  const seen = new Set<string>();
  return [...incoming, ...existing].filter((item) => {
    const value = key(item).toLowerCase().trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  }).slice(0, limit);
}

function mergeResult(workspace: PersonalWorkspace, result: ReconstructionResult, text: string, answeredQuestion?: string) {
  const previous = workspace.transition;
  const projects = mergeUnique(previous.projects, result.projects, (item) => item.name, 12);
  const risks = mergeUnique(previous.risks, result.risks, (item) => item.title, 10);
  let gaps = mergeUnique(previous.gaps, result.gaps, (item) => item.question, 12);
  if (answeredQuestion) gaps = gaps.filter((gap) => gap.question !== answeredQuestion);

  const sourceCount = Math.max(1, previous.sources.length);
  const metrics = result.metrics.map((metric) => {
    const old = previous.metrics.find((item) => item.label === metric.label);
    if (!old) return metric;
    return { ...metric, value: Math.round((old.value * sourceCount + metric.value) / (sourceCount + 1)) };
  });
  const readiness = Math.round((previous.readiness * sourceCount + result.readiness) / (sourceCount + 1));
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
  } satisfies PersonalWorkspace;
}

function Tour({ step, onNext, onClose }: { step: number; onNext: () => void; onClose: () => void }) {
  const items = [
    { selector: "[data-tour='sources']", title: "Start with evidence", body: "Every handoff begins with the artifacts that already exist. Add a PRD or choose a Google Drive file before asking a human questions." },
    { selector: "[data-tour='map']", title: "Review the reconstruction", body: "This is Understudy's evidence-backed model of the role. Low-confidence or missing context stays visible instead of being invented." },
    { selector: "[data-tour='interview']", title: "Fill only the gaps", body: "Interview questions come from missing rationale, ownership, exceptions, and risks that the sources could not explain." },
    { selector: "[data-tour='handoff']", title: "Verify the transfer", body: "The handoff stays connected to source coverage and unresolved questions so a polished document cannot hide missing knowledge." },
  ];
  const item = items[step];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!item) return;
    const update = () => {
      const element = document.querySelector(item.selector) as HTMLElement | null;
      setRect(element?.getBoundingClientRect() ?? null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [item]);

  if (!item || !rect) return null;
  const left = Math.min(Math.max(16, rect.left), window.innerWidth - 330);
  const top = Math.min(rect.bottom + 10, window.innerHeight - 190);
  return (
    <>
      <div className="pointer-events-none fixed z-[80] rounded-xl border-2 border-[#7d87f5] shadow-[0_0_0_9999px_rgba(0,0,0,0.46),0_0_35px_rgba(94,106,210,0.35)]" style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }} />
      <div className="fixed z-[90] w-[310px] rounded-xl border border-[#6873e4]/45 bg-[#15161a] p-4 shadow-2xl" style={{ left, top }}>
        <div className="flex items-center justify-between"><span className="font-mono text-[9px] text-[#aeb4ff]">GUIDE {step + 1}/4</span><button onClick={onClose} className="text-[9px] text-faint hover:text-muted">Skip</button></div>
        <h3 className="mt-2 text-[12px] font-medium">{item.title}</h3>
        <p className="mt-1.5 text-[9.5px] leading-4 text-muted">{item.body}</p>
        <button onClick={onNext} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10px] font-medium text-white">{step === 3 ? "Finish tour" : "Next"}<IconChevronRight /></button>
      </div>
    </>
  );
}

export function ProductionWorkspace() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [stage, setStage] = useState<Stage>("sources");
  const [tourStep, setTourStep] = useState(-1);
  const [sourceMode, setSourceMode] = useState<SourceMode>("paste");
  const [showAdd, setShowAdd] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceProvider, setSourceProvider] = useState("Pasted evidence");
  const [analysisPhase, setAnalysisPhase] = useState(-1);
  const [message, setMessage] = useState("");
  const [googleToken, setGoogleToken] = useState("");
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loaded = getCurrentWorkspace();
    setWorkspace(loaded);
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1" && window.localStorage.getItem("understudy:workspace-tour-seen") !== "1") setTourStep(0);
  }, []);

  const transition = workspace?.transition;
  const unreviewed = useMemo(() => transition?.sources.filter((source) => !workspace?.reviewedSourceIds.includes(source.id)) ?? [], [transition, workspace]);
  const nextQuestion = transition?.gaps[0]?.question ?? "What would a successor need to know that is not obvious from the current evidence?";
  const recommended: Stage = !transition?.sources.length ? "sources" : unreviewed.length ? "map" : transition.gaps.length ? "interview" : "handoff";

  function persist(next: PersonalWorkspace) {
    setWorkspace(next);
    saveWorkspace(next);
  }

  async function analyseSource(input: { title: string; text: string; provider: string; kind?: EvidenceKind }, answeredQuestion?: string) {
    if (!workspace || input.text.trim().length < 20) return;
    setMessage("");
    setAnalysisPhase(0);
    const interval = window.setInterval(() => setAnalysisPhase((value) => Math.min(value + 1, ANALYSIS_PHASES.length - 1)), 700);
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
          source: { title: input.title, text: input.text, provider: input.provider, kind: input.kind ?? "document" },
        }),
      });
      const payload = (await response.json()) as { result?: ReconstructionResult; usedModel?: boolean; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Could not analyse this evidence.");
      const next = mergeResult(workspace, payload.result, input.text, answeredQuestion);
      persist(next);
      setSourceTitle("");
      setSourceText("");
      setShowAdd(false);
      setInterviewAnswer("");
      setMessage(payload.usedModel ? "Gemini analysed the new evidence. Review the reconstruction before verifying it." : "Evidence imported with deterministic fallback because Gemini was unavailable.");
      setStage("map");
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
      setMessage("This build currently parses TXT, Markdown, JSON, CSV and Google Docs. PDF/DOCX parsing is not wired yet.");
      return;
    }
    setSourceTitle(file.name);
    setSourceText((await file.text()).slice(0, 60_000));
    setSourceProvider("Uploaded document");
  }

  async function connectDrive() {
    setMessage("");
    if (!googleDriveConfigured()) {
      setMessage("Google Drive integration is ready in code but this deployment still needs NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY configured in Cloudflare.");
      return;
    }
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
    persist({ ...workspace, updatedAt: new Date().toISOString(), reviewedSourceIds: [...new Set([...workspace.reviewedSourceIds, source.id])] });
  }

  function finishTour() {
    setTourStep(-1);
    window.localStorage.setItem("understudy:workspace-tour-seen", "1");
  }

  const handoff = useMemo(() => {
    if (!transition) return "";
    return `# ${transition.role} handoff\n\n**From:** ${transition.person}\n**To:** ${transition.successor}\n**Target:** ${transition.targetDate}\n\n## Role overview\n${transition.summary}\n\n## Active work\n${transition.projects.map((project) => `- **${project.name}** — ${project.state}; ${project.ownership}`).join("\n") || "- No active work confidently reconstructed yet."}\n\n## Continuity risks\n${transition.risks.map((risk) => `- **${risk.title}** — ${risk.detail}`).join("\n") || "- No material continuity risks identified from current evidence."}\n\n## Open questions\n${transition.gaps.map((gap) => `- ${gap.question}`).join("\n") || "- No open questions from current evidence."}\n\n## Evidence\n${transition.sources.map((source) => `- ${source.title} (${source.provider})`).join("\n")}`;
  }, [transition]);

  if (!workspace || !transition) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-[25px] font-semibold tracking-[-0.04em]">No personal transition yet.</h1>
        <p className="mt-2 text-[11px] leading-5 text-muted">Start with a real role and one real source. Understudy will build the workspace from your evidence.</p>
        <button onClick={() => window.location.assign("/")} className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white">Start onboarding</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8 lg:py-8">
      {tourStep >= 0 && <Tour step={tourStep} onNext={() => tourStep === 3 ? finishTour() : setTourStep((value) => value + 1)} onClose={finishTour} />}

      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-card px-2 py-1 text-[9px] text-subtle">{transition.type}</span>
            <span className="text-[9.5px] text-faint">Target {transition.targetDate}</span>
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.045em]">{transition.person} · {transition.role}</h1>
          <p className="mt-1 text-[11px] text-muted">Preparing {transition.successor} to continue the work without losing decision context.</p>
        </div>
        <div className="w-full rounded-xl border border-border bg-card p-3 lg:w-64">
          <div className="flex items-center justify-between text-[9.5px]"><span className="text-subtle">Transfer readiness</span><span className="font-mono text-muted">{transition.readiness}%</span></div>
          <div className="mt-2"><Bar value={transition.readiness} /></div>
          <p className="mt-2 text-[9px] text-faint">Readiness is evidence coverage, not an AI confidence guess.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-2 md:grid-cols-4">
        {STAGES.map((item) => {
          const completed = item.key === "sources" ? transition.sources.length > 0 : item.key === "map" ? workspace.reviewedSourceIds.length > 0 : item.key === "interview" ? transition.sources.some((source) => source.kind === "interview") : false;
          return (
            <button key={item.key} data-tour={item.key} onClick={() => setStage(item.key)} className={`rounded-xl border p-3 text-left transition-colors ${stage === item.key ? "border-[#6873e4]/50 bg-accent-soft" : "border-border bg-card hover:bg-card-hover"}`}>
              <div className="flex items-center justify-between"><span className={`text-[10.5px] font-medium ${stage === item.key ? "text-foreground" : "text-muted"}`}>{item.label}</span><span className="flex items-center gap-1.5">{completed && <IconCheck className="h-3.5 w-3.5 text-ok" />}<Tooltip text={item.help} /></span></div>
              <p className="mt-2 text-[9px] text-faint">{item.key === recommended ? "Recommended next" : completed ? "Completed" : "Available"}</p>
            </button>
          );
        })}
      </div>

      {message && <div className="mb-5 rounded-lg border border-border bg-card px-3 py-2.5 text-[9.5px] leading-4 text-muted">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          {stage === "sources" && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-4"><div><h2 className="text-[14px] font-medium">Evidence sources</h2><p className="mt-1 text-[10px] text-subtle">What would the successor already be able to inspect if the current owner disappeared tomorrow?</p></div><button onClick={() => setShowAdd((value) => !value)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10.5px] font-medium text-white"><IconUpload /> Add evidence</button></div>

              {showAdd && (
                <div className="mb-5 rounded-xl border border-[#5e6ad2]/35 bg-[rgba(94,106,210,0.05)] p-4">
                  <div className="flex flex-wrap gap-2">{(["paste", "upload", "drive"] as SourceMode[]).map((item) => <button key={item} onClick={() => setSourceMode(item)} className={`rounded-md px-2.5 py-1.5 text-[9.5px] ${sourceMode === item ? "bg-accent text-white" : "border border-border bg-card text-muted"}`}>{item === "paste" ? "Paste text" : item === "upload" ? "Upload file" : "Google Drive"}</button>)}</div>
                  {sourceMode === "paste" && <><input value={sourceTitle} onChange={(event) => { setSourceTitle(event.target.value); setSourceProvider("Pasted evidence"); }} placeholder="Source title" className="mt-4 h-9 w-full rounded-lg border border-border bg-background px-3 text-[10.5px] outline-none placeholder:text-faint" /><textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setSourceProvider("Pasted evidence"); }} rows={8} placeholder="Paste the PRD, spec, project note, or exported work context…" className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-[10px] leading-5 outline-none placeholder:text-faint" /></>}
                  {sourceMode === "upload" && <><button onClick={() => fileInput.current?.click()} className="mt-4 flex h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-background"><IconFile className="text-muted" /><span className="mt-2 text-[10px] text-muted">Choose TXT, Markdown, JSON, or CSV</span></button><input ref={fileInput} type="file" className="hidden" accept=".txt,.md,.json,.csv" onChange={(event) => void readUpload(event.target.files?.[0])} />{sourceTitle && <p className="mt-2 text-[9.5px] text-muted">Selected: {sourceTitle}</p>}</>}
                  {sourceMode === "drive" && <div className="mt-4 rounded-lg border border-border bg-background p-5 text-center"><p className="text-[10.5px] font-medium">Choose exactly one file from Google Drive</p><p className="mt-1 text-[9.5px] text-subtle">Uses the narrow drive.file permission. Understudy cannot roam through the rest of your Drive.</p><button onClick={() => void connectDrive()} className="mt-3 rounded-lg border border-border-strong bg-card px-3 py-2 text-[10px] text-muted hover:bg-card-hover">Connect Google & choose file</button>{sourceProvider === "Google Drive" && sourceTitle && <p className="mt-2 text-[9.5px] text-ok">Selected: {sourceTitle}</p>}</div>}
                  {analysisPhase >= 0 ? <div className="mt-4 space-y-2 rounded-lg border border-border bg-background p-3">{ANALYSIS_PHASES.map((phase, index) => <div key={phase} className={`flex items-center gap-2 text-[9px] ${index <= analysisPhase ? "text-muted" : "text-faint"}`}><span className={`h-1.5 w-1.5 rounded-full ${index < analysisPhase ? "bg-ok" : index === analysisPhase ? "animate-pulse bg-accent" : "bg-surface-3"}`} />{phase}</div>)}</div> : <div className="mt-4 flex justify-end"><button disabled={!sourceTitle.trim() || sourceText.trim().length < 20} onClick={() => void analyseSource({ title: sourceTitle, text: sourceText, provider: sourceProvider })} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10px] font-medium text-white disabled:opacity-35"><IconSpark /> Analyse evidence</button></div>}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {transition.sources.length ? transition.sources.map((source, index) => {
                  const verified = workspace.reviewedSourceIds.includes(source.id);
                  return <div key={source.id} className={`grid gap-3 p-4 sm:grid-cols-[36px_minmax(0,1fr)_130px] sm:items-center ${index ? "border-t border-border" : ""}`}><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">{source.kind === "interview" ? <IconMessage className="text-muted" /> : <IconFile className="text-muted" />}</div><div><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-medium">{source.title}</p><span className={`rounded px-1.5 py-0.5 text-[8px] ${verified ? "bg-ok/10 text-ok" : "bg-warning/10 text-warning"}`}>{verified ? "Verified" : "Needs review"}</span></div><p className="mt-1 text-[9px] text-subtle">{source.provider} · {source.extracted.join(" · ")}</p></div>{verified ? <span className="text-right text-[9px] text-subtle">Reviewed</span> : <button onClick={() => { verifySource(source); setStage("map"); }} className="rounded-md border border-border px-2 py-1.5 text-[9px] text-muted hover:bg-card-hover">Review findings</button>}</div>;
                }) : <div className="p-10 text-center"><IconFile className="mx-auto text-faint" /><p className="mt-3 text-[11px] font-medium">No evidence yet</p><p className="mt-1 text-[9.5px] text-subtle">Add the first real artifact. Understudy will not invent a role model without evidence.</p></div>}
              </div>
            </section>
          )}

          {stage === "map" && (
            <section>
              <div className="mb-4"><h2 className="text-[14px] font-medium">Reconstruction</h2><p className="mt-1 text-[10px] text-subtle">This is a working model, not a generated truth. Verify it against the sources and the person doing the work.</p></div>
              {!transition.projects.length ? <div className="rounded-xl border border-border bg-card p-10 text-center text-[10px] text-subtle">Add evidence before Understudy can reconstruct the role.</div> : <div className="space-y-5">
                <div className="overflow-hidden rounded-xl border border-border bg-card">{transition.projects.map((project, index) => <div key={project.name} className={`${index ? "border-t border-border" : ""} p-4`}><div className="flex items-start justify-between gap-4"><div><p className="text-[11.5px] font-medium">{project.name}</p><p className="mt-1 text-[9.5px] text-subtle">{project.state} · {project.ownership}</p></div><span className="font-mono text-[9px] text-muted">{project.evidence}% evidence</span></div><div className="mt-3"><Bar value={project.evidence} /></div></div>)}</div>
                <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconAlert className="text-warning" /><h3 className="text-[11px] font-medium">Continuity risks</h3></div><div className="mt-3 space-y-3">{transition.risks.map((risk) => <div key={risk.title}><p className="text-[10px] font-medium text-muted">{risk.title}</p><p className="mt-1 text-[9px] leading-4 text-subtle">{risk.detail}</p></div>)}</div></div><div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><IconSpark className="text-[#aeb4ff]" /><h3 className="text-[11px] font-medium">What the evidence cannot answer</h3></div><div className="mt-3 space-y-3">{transition.gaps.map((gap) => <div key={gap.question}><p className="text-[9px] text-subtle">{gap.topic}</p><p className="mt-1 text-[10px] leading-4 text-muted">{gap.question}</p></div>)}</div></div></div>
                {unreviewed.length > 0 && <button onClick={() => verifySource(unreviewed[0])} className="rounded-lg bg-accent px-3 py-2 text-[10px] font-medium text-white">This reconstruction looks right · verify latest source</button>}
              </div>}
            </section>
          )}

          {stage === "interview" && (
            <section className="mx-auto max-w-3xl">
              <div className="mb-4"><h2 className="text-[14px] font-medium">Adaptive interview</h2><p className="mt-1 text-[10px] text-subtle">Understudy is asking this because the current evidence cannot resolve it confidently.</p></div>
              <div className="rounded-xl border border-border bg-card p-5 sm:p-6"><span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#aeb4ff]">Highest-value gap</span><h3 className="mt-3 text-[18px] font-medium leading-7 tracking-[-0.025em]">{nextQuestion}</h3>{transition.gaps[0] && <p className="mt-2 text-[9.5px] text-subtle">Topic: {transition.gaps[0].topic} · {transition.gaps[0].priority}</p>}<textarea value={interviewAnswer} onChange={(event) => setInterviewAnswer(event.target.value)} rows={7} placeholder="Answer the way you would explain it to the person taking over…" className="mt-5 w-full rounded-lg border border-border bg-background p-3 text-[10.5px] leading-5 outline-none placeholder:text-faint" /><div className="mt-3 flex justify-end"><button disabled={interviewAnswer.trim().length < 20 || analysisPhase >= 0} onClick={() => void analyseSource({ title: `Handoff interview · ${transition.gaps[0]?.topic || "role context"}`, text: interviewAnswer, provider: "Understudy interview", kind: "interview" }, transition.gaps[0]?.question)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10px] font-medium text-white disabled:opacity-35">Save answer & update handoff <IconSpark /></button></div></div>
            </section>
          )}

          {stage === "handoff" && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-[14px] font-medium">Handoff draft</h2><p className="mt-1 text-[10px] text-subtle">Generated from the evidence you added; unresolved questions remain visible.</p></div><button onClick={async () => { await navigator.clipboard.writeText(handoff); setMessage("Handoff copied as Markdown."); }} className="rounded-lg border border-border bg-card px-3 py-2 text-[9.5px] text-muted hover:bg-card-hover">Copy Markdown</button></div>
              <article className="rounded-xl border border-border bg-[#0d0e10] p-6 text-[10.5px] leading-5 text-muted"><h1 className="text-[24px] font-semibold tracking-[-0.04em] text-foreground">{transition.role} handoff</h1><p className="mt-1 text-[9.5px] text-subtle">{transition.person} → {transition.successor}</p><h2 className="mt-7 text-[12px] font-medium text-foreground">Role overview</h2><p className="mt-2">{transition.summary}</p><h2 className="mt-6 text-[12px] font-medium text-foreground">Active work</h2><div className="mt-2 space-y-2">{transition.projects.map((project) => <div key={project.name} className="border-b border-border pb-2"><span className="text-foreground">{project.name}</span><span className="ml-2 text-subtle">{project.state}</span></div>)}</div><h2 className="mt-6 text-[12px] font-medium text-foreground">Open questions</h2><div className="mt-2 space-y-2">{transition.gaps.length ? transition.gaps.map((gap) => <p key={gap.question}>• {gap.question}</p>) : <p>No unresolved questions from current evidence.</p>}</div><h2 className="mt-6 text-[12px] font-medium text-foreground">Evidence</h2><div className="mt-2 flex flex-wrap gap-1.5">{transition.sources.map((source) => <span key={source.id} className="rounded border border-border bg-card px-1.5 py-0.5 text-[8.5px] text-subtle">{source.title}</span>)}</div></article>
            </section>
          )}
        </main>

        <aside>
          <div className="sticky top-6 space-y-4">
            <div className="rounded-xl border border-[#5e6ad2]/30 bg-accent-soft p-4"><div className="flex items-center gap-2"><IconSpark className="text-[#b9beff]" /><p className="text-[10.5px] font-medium">What to do next</p></div><p className="mt-2 text-[9.5px] leading-4 text-muted">{recommended === "sources" ? "Add a real PRD, work note, or Google Drive file. Understudy needs evidence before it asks questions." : recommended === "map" ? `Review the latest reconstruction and verify the source if it matches reality. ${unreviewed.length} source${unreviewed.length === 1 ? "" : "s"} still need review.` : recommended === "interview" ? `Answer the highest-value open question. There are ${transition.gaps.length} unresolved knowledge gaps.` : "The current evidence has no open interview gaps. Review and share the handoff."}</p><button onClick={() => setStage(recommended)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[9.5px] font-medium text-white">Go to next step <IconChevronRight /></button></div>
            <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><p className="text-[10.5px] font-medium">Coverage</p><Tooltip text="Coverage reflects what the current evidence supports across responsibilities, active work, decisions, tacit knowledge, ownership, and successor review." /></div><div className="mt-4 space-y-3">{transition.metrics.map((metric) => <div key={metric.label}><div className="mb-1 flex items-center justify-between text-[8.5px]"><span className="text-subtle">{metric.label}</span><span className="font-mono text-muted">{metric.value}%</span></div><Bar value={metric.value} /></div>)}</div></div>
            <button onClick={() => setTourStep(0)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[9.5px] text-subtle hover:bg-card">Show me how this workspace works</button>
            <p className="px-1 text-[8.5px] leading-4 text-faint">Workspace owner: {getIdentity().email || getIdentity().name}. Personal trial data is isolated in this browser/account namespace.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
