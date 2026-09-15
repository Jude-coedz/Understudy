"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { getCurrentWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import type { WorkspaceAskContext, WorkspaceAskResponse } from "@/lib/workspace-ask";
import { IconFile, IconSpark } from "./icons";

export function AskView() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<WorkspaceAskResponse | null>(null);

  useEffect(() => {
    setWorkspace(getCurrentWorkspace());
  }, []);

  const sourceCount = workspace?.transition.sources.length ?? 0;
  const samples = useMemo(() => {
    if (!workspace) return [];
    const firstProject = workspace.transition.projects[0]?.name;
    return [
      firstProject ? `What does the evidence say about ${firstProject}?` : "What work is this role responsible for?",
      "What decisions or tradeoffs should the successor understand?",
      "What risks or unresolved issues should the successor know about?",
    ];
  }, [workspace]);

  function buildContext(current: PersonalWorkspace): WorkspaceAskContext {
    const transition = current.transition;
    return {
      workspaceId: current.id,
      transition: {
        person: transition.person,
        role: transition.role,
        department: transition.department,
        successor: transition.successor,
        targetDate: transition.targetDate,
        summary: transition.summary,
        projects: transition.projects,
        risks: transition.risks,
        gaps: transition.gaps,
      },
      sources: transition.sources
        .map((source) => ({
          id: source.id,
          title: source.title,
          provider: source.provider,
          kind: source.kind,
          body: current.sourceBodies[source.id] ?? "",
        }))
        .filter((source) => source.body.trim().length > 0),
    };
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy || !workspace) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: buildContext(workspace) }),
      });
      const payload = (await res.json()) as WorkspaceAskResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Understudy could not answer that question.");
      setAnswer(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Understudy could not answer that question.");
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(text);
    }
  }

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.035em]">Ask needs a workspace first.</h1>
        <p className="mt-2 text-[13px] leading-5 text-muted">Create a transition and add real evidence before asking Understudy about the work.</p>
        <button onClick={() => window.location.assign("/")} className="mt-5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-white">Start a transition</button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-44px)] max-w-3xl flex-col px-5 py-7 lg:py-10">
      <div className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-subtle">Ask Understudy</p>
            <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.035em]">Ask about {workspace.transition.person}&apos;s handoff.</h1>
          </div>
          <button onClick={() => window.location.assign("/workspace")} className="rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted hover:bg-card-hover">View workspace</button>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-muted">
          Answers are restricted to the evidence in this transition. Understudy will say it does not know rather than fill missing context with a guess.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-subtle">{workspace.transition.role}</span>
          <span className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-subtle">{sourceCount} source{sourceCount === 1 ? "" : "s"} in workspace</span>
        </div>
      </div>

      <div className="flex-1 py-6">
        {error && <div className="mb-4 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-[13px] text-danger">{error}</div>}

        {!answer && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2"><IconSpark className="text-muted" /><h2 className="text-[14px] font-medium">Try a workspace question</h2></div>
            <div className="mt-4 grid gap-2">
              {samples.map((sample) => (
                <button key={sample} onClick={() => void send(sample)} disabled={busy || sourceCount === 0} className="rounded-lg border border-border bg-background px-3 py-3 text-left text-[13px] text-muted transition-colors hover:bg-card-hover disabled:opacity-40">
                  {sample}
                </button>
              ))}
            </div>
            {sourceCount === 0 && <p className="mt-4 text-[12px] text-warning">There is no evidence in this workspace yet. Add a PRD, Drive file, or another source first.</p>}
          </div>
        )}

        {answer && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Question</p>
              <p className="mt-2 text-[14px] text-muted">{answer.question}</p>
              {answer.unknown ? (
                <div className="mt-5 rounded-lg border border-warning/25 bg-warning/5 p-4">
                  <p className="text-[13px] font-medium text-warning">The current evidence cannot answer this reliably.</p>
                  <p className="mt-2 text-[13px] leading-5 text-muted">{answer.gap}</p>
                </div>
              ) : (
                <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-foreground">{answer.answer}</p>
              )}
            </div>

            {answer.citations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-medium">Evidence used</h2><span className="text-[11px] text-faint">{answer.citations.length} cited source{answer.citations.length === 1 ? "" : "s"}</span></div>
                <div className="space-y-2">
                  {answer.citations.map((citation) => (
                    <div key={citation.sourceId} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background"><IconFile className="text-muted" /></div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">{citation.title}</p>
                          <p className="mt-0.5 text-[11px] text-subtle">{citation.provider} · {citation.kind}</p>
                          <p className="mt-2 text-[12px] leading-5 text-muted">{citation.excerpt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setAnswer(null)} className="text-[12px] text-muted hover:text-foreground">Ask another question</button>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background/95 pt-3 pb-4 backdrop-blur">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
          rows={3}
          disabled={sourceCount === 0}
          placeholder={sourceCount ? "Ask about a decision, project, risk, owner, dependency, or anything in this handoff…" : "Add evidence to the workspace before asking a question."}
          className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-[14px] leading-6 outline-none placeholder:text-faint disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-faint">Enter to send · Shift+Enter for a new line</p>
          <button disabled={busy || !text.trim() || sourceCount === 0} onClick={() => void send(text)} className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white disabled:opacity-40">
            {busy ? "Checking evidence…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
