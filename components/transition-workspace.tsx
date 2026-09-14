"use client";

import { useMemo, useState } from "react";
import type { SourceItem, Transition } from "@/data/v2-demo";
import { buildAiContextPrompt } from "@/data/v2-demo";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconFile,
  IconGithub,
  IconMessage,
  IconPlus,
  IconSpark,
  IconUpload,
} from "./icons";

type TabKey = "overview" | "sources" | "work" | "interview" | "handover" | "questions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sources", label: "Sources" },
  { key: "work", label: "Work map" },
  { key: "interview", label: "Interview" },
  { key: "handover", label: "Handover" },
  { key: "questions", label: "Questions" },
];

function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

function SourceMark({ source }: { source: SourceItem }) {
  const shared = "h-4 w-4";
  if (source.kind === "github") return <IconGithub className={`${shared} text-muted`} />;
  if (source.kind === "ai-context") return <IconSpark className={`${shared} text-[#aeb4ff]`} />;
  if (source.kind === "interview") return <IconMessage className={`${shared} text-muted`} />;
  return <IconFile className={`${shared} text-muted`} />;
}

function OverviewTab({ transition }: { transition: Transition }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-medium">Transfer readiness</h2>
              <p className="mt-0.5 text-[10.5px] text-subtle">
                What has been captured, verified, and transferred.
              </p>
            </div>
            <span className="font-mono text-[11px] text-muted">{transition.readiness}% overall</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {transition.metrics.map((metric, index) => (
              <div
                key={metric.label}
                className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[150px_minmax(120px,1fr)_130px_42px] sm:items-center ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <p className="text-[11.5px] font-medium">{metric.label}</p>
                <ProgressBar value={metric.value} />
                <p className="text-[10px] text-subtle">{metric.note}</p>
                <p className="text-right font-mono text-[10px] text-muted">{metric.value}%</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-[13px] font-medium">Work reconstructed</h2>
            <p className="mt-0.5 text-[10.5px] text-subtle">
              Projects Understudy inferred from the connected evidence.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {transition.projects.length ? (
              transition.projects.map((project, index) => (
                <div
                  key={project.name}
                  className={`grid gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_110px_150px_70px] sm:items-center ${
                    index > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div>
                    <p className="text-[11.5px] font-medium">{project.name}</p>
                    <p className="mt-0.5 text-[9.5px] text-faint">{project.ownership}</p>
                  </div>
                  <span className="w-fit rounded-md border border-border bg-background px-1.5 py-0.5 text-[9px] text-muted">
                    {project.state}
                  </span>
                  <div>
                    <div className="mb-1 flex justify-between text-[9px] text-subtle">
                      <span>Evidence coverage</span>
                      <span>{project.evidence}%</span>
                    </div>
                    <ProgressBar value={project.evidence} />
                  </div>
                  <button className="text-left text-[10px] text-muted hover:text-foreground sm:text-right">Review</button>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[11px] text-subtle">Connect sources to reconstruct this work map.</div>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Continuity risks</h2>
            <span className="font-mono text-[10px] text-danger">{transition.risks.length || 2}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {transition.risks.length ? (
              transition.risks.map((risk, index) => (
                <div key={risk.title} className={`${index > 0 ? "border-t border-border" : ""} p-3.5`}>
                  <div className="flex gap-2.5">
                    <IconAlert className={risk.severity === "High" ? "mt-0.5 shrink-0 text-danger" : "mt-0.5 shrink-0 text-warning"} />
                    <div>
                      <p className="text-[10.5px] font-medium leading-4">{risk.title}</p>
                      <p className="mt-1.5 text-[9.5px] leading-4 text-subtle">{risk.detail}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-[10.5px] text-subtle">Risk analysis will appear after evidence is processed.</div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Next best questions</h2>
            <span className="font-mono text-[10px] text-subtle">{transition.gaps.length}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {transition.gaps.length ? (
              transition.gaps.map((gap, index) => (
                <div key={gap.question} className={`${index > 0 ? "border-t border-border" : ""} p-3.5`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-subtle">{gap.topic}</span>
                    <span className={`text-[8.5px] uppercase tracking-[0.08em] ${gap.priority === "Critical" ? "text-danger" : "text-warning"}`}>
                      {gap.priority}
                    </span>
                  </div>
                  <p className="text-[10.5px] leading-4 text-muted">{gap.question}</p>
                </div>
              ))
            ) : (
              <div className="p-4 text-[10.5px] text-subtle">No open questions yet.</div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function SourcesTab({ transition }: { transition: Transition }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(
    () => buildAiContextPrompt(transition.person, transition.role),
    [transition.person, transition.role],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const counts = transition.sources.reduce<Record<string, number>>((acc, source) => {
    acc[source.kind] = (acc[source.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[13px] font-medium">Evidence sources</h2>
            <p className="mt-0.5 text-[10.5px] text-subtle">
              Understudy keeps every extracted claim linked to where it came from.
            </p>
          </div>
          <button className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-2.5 text-[10.5px] text-muted transition-colors hover:bg-card-hover hover:text-foreground">
            <IconUpload />
            Add source
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["Documents", counts.document ?? 0],
            ["GitHub", counts.github ?? 0],
            ["AI context", counts["ai-context"] ?? 0],
            ["Interviews", counts.interview ?? 0],
          ].map(([label, count]) => (
            <span key={label} className="rounded-md border border-border bg-card px-2 py-1 text-[9.5px] text-subtle">
              {label} <span className="ml-1 font-mono text-muted">{count}</span>
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {transition.sources.length ? (
            transition.sources.map((source, index) => (
              <div
                key={source.id}
                className={`grid gap-3 px-4 py-4 sm:grid-cols-[32px_minmax(0,1fr)_160px] sm:items-center ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
                  <SourceMark source={source} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[11.5px] font-medium">{source.title}</p>
                    <span
                      className={`rounded-[4px] px-1.5 py-0.5 text-[8.5px] ${
                        source.confidence === "Primary"
                          ? "bg-ok/10 text-[#76c996]"
                          : source.confidence === "AI-recovered"
                            ? "bg-accent-soft text-[#aeb4ff]"
                            : "bg-warning/10 text-[#daba72]"
                      }`}
                    >
                      {source.confidence}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9.5px] text-subtle">{source.provider} · {source.meta}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {source.extracted.map((item) => (
                      <span key={item} className="rounded-[4px] border border-border bg-background px-1.5 py-0.5 text-[8.5px] text-subtle">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="text-left text-[10px] text-muted hover:text-foreground sm:text-right">Inspect extraction</button>
              </div>
            ))
          ) : (
            <div className="px-4 py-10 text-center text-[11px] text-subtle">No evidence connected yet.</div>
          )}
        </div>
      </div>

      <aside>
        <div className="rounded-xl border border-[#5e6ad2]/30 bg-[rgba(94,106,210,0.07)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#5e6ad2]/30 bg-accent-soft">
              <IconSpark className="text-[#b5baff]" />
            </div>
            <div>
              <p className="text-[11.5px] font-medium">Recover AI work context</p>
              <p className="mt-1 text-[9.5px] leading-4 text-muted">
                Some of the reasoning behind this work may live in ChatGPT, Claude, Gemini, or another assistant. Generate a structured recovery prompt and bring the result back as evidence.
              </p>
            </div>
          </div>

          {!showPrompt ? (
            <button
              onClick={() => setShowPrompt(true)}
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10.5px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <IconSpark />
              Generate recovery prompt
            </button>
          ) : (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[9.5px] font-medium text-muted">Prompt for any AI assistant</p>
                <button onClick={copyPrompt} className="text-[9.5px] text-[#aeb4ff] hover:text-white">
                  {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 font-mono text-[8.5px] leading-4 text-subtle">
                {prompt}
              </pre>
              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <p className="text-[9.5px] font-medium">Then paste the response back here</p>
                <textarea
                  rows={4}
                  placeholder="Paste structured Markdown from ChatGPT, Claude, Gemini…"
                  className="mt-2 w-full resize-none rounded-lg border border-border bg-card p-2.5 text-[9.5px] text-muted placeholder:text-faint"
                />
                <button className="mt-2 h-8 rounded-lg border border-border-strong bg-card-hover px-3 text-[10px] font-medium text-foreground hover:bg-surface-3">
                  Import as AI-recovered evidence
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-border p-4">
          <p className="text-[10.5px] font-medium">Evidence policy</p>
          <div className="mt-3 space-y-3 text-[9.5px] leading-4 text-subtle">
            <p><span className="text-[#76c996]">Primary</span> — documents, tickets, commits, and direct system records.</p>
            <p><span className="text-[#aeb4ff]">AI-recovered</span> — context reconstructed by another AI assistant; must be reviewed before it becomes verified knowledge.</p>
            <p><span className="text-[#daba72]">Self-reported</span> — employee interview or manual statement.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function WorkMapTab({ transition }: { transition: Transition }) {
  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h2 className="text-[13px] font-medium">Reconstructed work map</h2>
        <p className="mt-0.5 text-[10.5px] text-subtle">What Understudy believes {transition.person} owns, grouped by work rather than file location.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {transition.projects.length ? transition.projects.map((project, index) => (
          <div key={project.name} className={`${index > 0 ? "border-t border-border" : ""} px-4 py-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[12px] font-medium">{project.name}</p>
                <p className="mt-1 text-[10px] text-subtle">{project.state} · {project.ownership}</p>
              </div>
              <span className="font-mono text-[10px] text-muted">{project.evidence}% evidence coverage</span>
            </div>
            <ProgressBar value={project.evidence} className="mt-3" />
          </div>
        )) : <div className="p-8 text-center text-[11px] text-subtle">No reconstructed work yet.</div>}
      </div>
    </div>
  );
}

function InterviewTab({ transition }: { transition: Transition }) {
  const question = transition.gaps[0]?.question ?? "What knowledge would be difficult for someone else to infer from the existing documentation?";
  return (
    <div className="mx-auto max-w-3xl py-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-medium">Adaptive handoff interview</h2>
          <p className="mt-0.5 text-[10.5px] text-subtle">Questions are generated from gaps in the evidence, not from a fixed questionnaire.</p>
        </div>
        <span className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[9px] text-subtle">Session 2 · 58%</span>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-[9.5px] text-subtle">
          <IconSpark className="text-[#aeb4ff]" />
          Highest-value unresolved question
        </div>
        <p className="max-w-2xl text-[17px] font-medium leading-7 tracking-[-0.02em]">{question}</p>
        <p className="mt-3 text-[10px] leading-4 text-subtle">
          Understudy found the decision in the PRD but could not verify the conditions for revisiting it from any primary source.
        </p>
        <textarea
          rows={7}
          placeholder="Explain it the way you would to the person taking over your role…"
          className="mt-6 w-full resize-none rounded-lg border border-border bg-background p-3 text-[11px] leading-5 text-foreground placeholder:text-faint"
        />
        <div className="mt-3 flex items-center justify-between">
          <button className="text-[10px] text-subtle hover:text-muted">Skip for now</button>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[10.5px] font-medium text-white hover:bg-accent-hover">
            Save & analyse
            <IconSpark />
          </button>
        </div>
      </div>
    </div>
  );
}

function HandoverTab({ transition }: { transition: Transition }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <article className="overflow-hidden rounded-xl border border-border bg-[#0d0e10]">
        <div className="border-b border-border px-6 py-5">
          <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-subtle">Draft handover</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em]">{transition.role} handover</h2>
          <p className="mt-1 text-[10.5px] text-subtle">{transition.person} → {transition.successor} · generated from verified evidence</p>
        </div>
        <div className="space-y-7 px-6 py-6 text-[11px] leading-5 text-muted">
          <section>
            <h3 className="mb-2 text-[12px] font-medium text-foreground">Role overview</h3>
            <p>{transition.summary}</p>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-medium text-foreground">Active work</h3>
            <div className="space-y-2">
              {transition.projects.map((project) => (
                <div key={project.name} className="flex items-center justify-between border-b border-border/70 pb-2">
                  <span>{project.name}</span>
                  <span className="text-[9.5px] text-subtle">{project.state}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-[12px] font-medium text-foreground">Important context</h3>
            <p>Approval workflow configurability was intentionally deferred from the current version. The PRD records the scope decision; the rationale is supported by Maya's reviewed AI-context import and handoff interview.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[8.5px] text-subtle">Approval Workflows PRD</span>
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[8.5px] text-subtle">AI context import</span>
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[8.5px] text-subtle">Interview #1</span>
            </div>
          </section>
        </div>
      </article>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10.5px] font-medium">Draft quality</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[26px] font-semibold tracking-[-0.04em]">78%</span>
            <span className="pb-1 text-[9.5px] text-subtle">ready</span>
          </div>
          <ProgressBar value={78} className="mt-2" />
          <p className="mt-3 text-[9.5px] leading-4 text-subtle">3 critical questions should be resolved before the final export.</p>
        </div>
        <button className="w-full rounded-lg bg-accent px-3 py-2.5 text-[10.5px] font-medium text-white hover:bg-accent-hover">Export handover</button>
        <button className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[10.5px] font-medium text-muted hover:bg-card-hover hover:text-foreground">Copy for Notion</button>
      </aside>
    </div>
  );
}

function QuestionsTab({ transition }: { transition: Transition }) {
  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h2 className="text-[13px] font-medium">Successor questions</h2>
        <p className="mt-0.5 text-[10.5px] text-subtle">Questions from the next owner become new knowledge gaps while {transition.person} is still available.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {transition.gaps.map((gap, index) => (
          <div key={gap.question} className={`${index > 0 ? "border-t border-border" : ""} p-4`}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-medium">{gap.question}</p>
              <span className="shrink-0 text-[9px] text-subtle">Open</span>
            </div>
            <p className="mt-1 text-[9.5px] text-subtle">{gap.topic} · detected from incomplete transfer coverage</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransitionWorkspace({ transition }: { transition: Transition }) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background">
        <div className="px-5 pt-5 lg:px-8 lg:pt-7">
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[11px] font-semibold text-muted">
                  {transition.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-[21px] font-semibold tracking-[-0.035em]">{transition.person}</h1>
                    <span className="rounded-[5px] border border-border bg-card px-1.5 py-0.5 text-[8.5px] text-subtle">{transition.status}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">{transition.role} · {transition.department}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9.5px] text-subtle">
                    <span className="flex items-center gap-1.5"><IconClock className="h-3.5 w-3.5" /> Target {transition.targetDate}</span>
                    <span>Successor: {transition.successor}</span>
                    <span>Manager: {transition.manager}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="min-w-[160px] rounded-lg border border-border bg-card px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[9px]">
                    <span className="text-subtle">Handoff readiness</span>
                    <span className="font-mono text-muted">{transition.readiness}%</span>
                  </div>
                  <ProgressBar value={transition.readiness} />
                </div>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[10.5px] text-muted hover:bg-card-hover hover:text-foreground">
                  <IconPlus />
                  Add evidence
                </button>
              </div>
            </div>

            <nav className="mt-6 flex gap-5 overflow-x-auto">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={`relative shrink-0 pb-3 text-[10.5px] transition-colors ${
                    tab === item.key ? "text-foreground" : "text-subtle hover:text-muted"
                  }`}
                >
                  {item.label}
                  {tab === item.key && <span className="absolute inset-x-0 bottom-0 h-px bg-accent" />}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-5 py-6 lg:px-8 lg:py-7">
        {tab === "overview" && <OverviewTab transition={transition} />}
        {tab === "sources" && <SourcesTab transition={transition} />}
        {tab === "work" && <WorkMapTab transition={transition} />}
        {tab === "interview" && <InterviewTab transition={transition} />}
        {tab === "handover" && <HandoverTab transition={transition} />}
        {tab === "questions" && <QuestionsTab transition={transition} />}
      </div>
    </div>
  );
}
