"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type KeyboardEvent } from "react";
import type { PersonalWorkspace } from "@/lib/personal-workspace";
import type { WorkspaceAskContext, WorkspaceAskResponse } from "@/lib/workspace-ask";
import { workspaceQuestionSuggestions } from "@/lib/workspace-question-suggestions";
import { IconFile, IconSpark } from "./icons";

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

export function EmbeddedAskPanel({
  workspace,
  onClose,
  heading = "Ask Understudy",
}: {
  workspace: PersonalWorkspace;
  onClose?: () => void;
  heading?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<WorkspaceAskResponse | null>(null);
  const sourceCount = workspace.transition.sources.filter((source) => source.kind !== "interview").length;
  const suggestions = useMemo(() => workspaceQuestionSuggestions(workspace).slice(0, 3), [workspace]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy || !sourceCount) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: buildContext(workspace) }),
      });
      const payload = (await response.json()) as WorkspaceAskResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Understudy could not answer that question.");
      setAnswer(payload);
      setText("");
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

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32 }}
      className="overflow-hidden rounded-2xl border border-border-strong bg-card shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><h2 className="text-base font-medium">{heading}</h2></div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-subtle">Ask without leaving this handoff. Answers use this workspace's evidence and cite the sources they rely on.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Close</button>}
      </div>

      <div className="p-5">
        {error && <div className="mb-4 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>}

        {!answer && suggestions.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">Useful questions for this handoff</p>
            <div className="mt-3 grid gap-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" disabled={busy} onClick={() => void send(suggestion)} className="rounded-xl border border-border bg-background px-4 py-3 text-left text-sm leading-6 text-muted transition-colors hover:bg-card-hover disabled:opacity-50">{suggestion}</button>
              ))}
            </div>
          </div>
        )}

        {answer && (
          <div className="mb-5 space-y-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-faint">{answer.question}</p>
              {answer.unknown ? (
                <div className="mt-3 rounded-lg border border-warning/25 bg-warning/5 p-3"><p className="text-sm font-medium text-warning">The current handoff cannot answer this reliably.</p><p className="mt-1 text-sm leading-6 text-muted">{answer.gap}</p></div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">{answer.answer}</p>
              )}
            </div>
            {answer.citations.length > 0 && <div><p className="text-xs font-medium text-subtle">Evidence used</p><div className="mt-2 space-y-2">{answer.citations.map((citation) => <div key={`${citation.sourceId}-${citation.excerpt}`} className="flex gap-3 rounded-xl border border-border bg-background p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"><IconFile className="h-4 w-4 text-muted" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{citation.title}</p><p className="mt-1 text-xs leading-5 text-subtle">{citation.excerpt}</p></div></div>)}</div></div>}
            <button type="button" onClick={() => setAnswer(null)} className="text-xs font-medium text-accent">Ask another question</button>
          </div>
        )}

        <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKey} rows={3} disabled={!sourceCount || busy} placeholder={sourceCount ? "Ask about an owner, decision, risk, dependency, project, or anything in this handoff…" : "Add evidence before asking a question."} className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-faint disabled:opacity-50" />
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[11px] text-faint">{sourceCount} evidence source{sourceCount === 1 ? "" : "s"} available · Enter to send</p><button type="button" disabled={busy || !text.trim() || !sourceCount} onClick={() => void send(text)} className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white disabled:opacity-40">{busy ? "Checking evidence…" : "Ask"}</button></div>
      </div>
    </motion.section>
  );
}
