"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { PersonalWorkspace } from "@/lib/personal-workspace";
import {
  fallbackWorkspaceAnswer,
  retrieveWorkspaceEvidence,
  type WorkspaceAskContext,
  type WorkspaceAskResponse,
} from "@/lib/workspace-ask";
import { workspaceQuestionSuggestions } from "@/lib/workspace-question-suggestions";
import { IconFile, IconSpark } from "./icons";

const THINKING_STATES = [
  "Searching this handoff's evidence…",
  "Comparing the most relevant sources…",
  "Checking the answer against its evidence…",
];

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
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState<WorkspaceAskResponse | null>(null);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const context = useMemo(() => buildContext(workspace), [workspace]);
  const sourceCount = context.sources.length;
  const suggestions = useMemo(() => workspaceQuestionSuggestions(workspace).slice(0, 3), [workspace]);

  useEffect(() => {
    if (!busy) {
      setThinkingIndex(0);
      return;
    }
    const timer = window.setInterval(
      () => setThinkingIndex((current) => (current + 1) % THINKING_STATES.length),
      1100,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy || !sourceCount) return;
    setBusy(true);
    setError("");
    setNotice("");
    setAnswer(null);
    setActiveQuestion(q);
    setThinkingIndex(0);

    const localFallback = fallbackWorkspaceAnswer(q, context, retrieveWorkspaceEvidence(q, context));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: (WorkspaceAskResponse & { error?: string }) | null = null;
      try {
        payload = raw ? JSON.parse(raw) as WorkspaceAskResponse & { error?: string } : null;
      } catch {
        payload = null;
      }
      if (!response.ok) throw new Error(payload?.error || `Ask failed with status ${response.status}.`);
      if (!payload || typeof payload.question !== "string" || !Array.isArray(payload.citations)) {
        throw new Error("Understudy received an invalid answer payload.");
      }
      setAnswer(payload);
      if (!payload.usedModel) {
        setNotice("AI synthesis was unavailable, so Understudy is showing the most relevant evidence instead of inventing an answer.");
      }
      setText("");
    } catch (caught) {
      setAnswer(localFallback);
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setNotice("AI synthesis took too long. Understudy kept the question and surfaced the most relevant evidence instead.");
      } else {
        setNotice("AI synthesis could not complete. Understudy fell back to the evidence already stored in this handoff.");
        setError(caught instanceof Error ? caught.message : "The AI answer could not be completed.");
      }
      setText("");
    } finally {
      window.clearTimeout(timeout);
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
      aria-busy={busy}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><h2 className="text-base font-medium">{heading}</h2></div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-subtle">Ask without leaving this handoff. Answers use this workspace&apos;s evidence and cite the sources they rely on.</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Close</button>}
      </div>

      <div className="p-5">
        {notice && <div className="mb-4 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-xs leading-5 text-muted" role="status">{notice}</div>}
        {error && <div className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-xs leading-5 text-muted">Technical detail: {error}</div>}

        {busy && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-5 overflow-hidden rounded-xl border border-accent/20 bg-accent-soft p-4" role="status" aria-live="polite">
            <div className="flex items-start gap-3">
              <motion.span animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-accent/20 border-t-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{THINKING_STATES[thinkingIndex]}</p>
                <p className="mt-1 text-xs leading-5 text-subtle">“{activeQuestion}”</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-accent/10"><motion.div className="h-full w-1/3 rounded-full bg-accent" animate={reducedMotion ? undefined : { x: ["-100%", "300%"] }} transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} /></div>
              </div>
            </div>
          </motion.div>
        )}

        {!answer && !busy && suggestions.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">Useful questions for this handoff</p>
            <div className="mt-3 grid gap-2">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" disabled={busy} onClick={() => void send(suggestion)} className="rounded-xl border border-border bg-background px-4 py-3 text-left text-sm leading-6 text-muted transition-colors hover:border-border-strong hover:bg-card-hover disabled:cursor-wait disabled:opacity-55">{suggestion}</button>
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
            <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setAnswer(null); setActiveQuestion(""); setNotice(""); setError(""); }} className="text-xs font-medium text-accent">Ask another question</button>{!answer.usedModel && <button type="button" onClick={() => void send(answer.question)} className="text-xs font-medium text-muted">Retry AI synthesis</button>}</div>
          </div>
        )}

        <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={onKey} rows={3} disabled={!sourceCount || busy} placeholder={sourceCount ? "Ask about an owner, decision, risk, dependency, project, or anything in this handoff…" : "Add readable evidence before asking a question."} className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-faint disabled:opacity-50" />
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[11px] text-faint">{sourceCount} readable evidence source{sourceCount === 1 ? "" : "s"} available · Enter to send</p><button type="button" disabled={busy || !text.trim() || !sourceCount} onClick={() => void send(text)} className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white disabled:opacity-40">{busy ? "Thinking…" : "Ask"}</button></div>
      </div>
    </motion.section>
  );
}
