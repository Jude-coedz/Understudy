"use client";

import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import {
  AI_ASSISTANTS,
  AI_CONTEXT_SCOPES,
  buildAIContextRecoveryPrompt,
  type AIContextAssistant,
  type AIContextScope,
} from "@/lib/ai-context";
import { IconCheck, IconSpark } from "./icons";

export function AIContextImport({
  transition,
  primarySourceTitles,
  knownWorkAreas,
  busy,
  onImport,
}: {
  transition: Transition;
  primarySourceTitles: string[];
  knownWorkAreas: string[];
  busy: boolean;
  onImport: (input: { assistant: AIContextAssistant; scope: AIContextScope; text: string }) => Promise<void>;
}) {
  const [assistant, setAssistant] = useState<AIContextAssistant>("ChatGPT");
  const [scope, setScope] = useState<AIContextScope>("history");
  const [responseText, setResponseText] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedScope = AI_CONTEXT_SCOPES.find((item) => item.id === scope) ?? AI_CONTEXT_SCOPES[0];
  const prompt = useMemo(
    () => buildAIContextRecoveryPrompt({ transition, primarySourceTitles, knownWorkAreas, assistant, scope }),
    [transition, primarySourceTitles, knownWorkAreas, assistant, scope],
  );

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function importContext() {
    const text = responseText.trim();
    if (text.length < 80 || busy) return;
    await onImport({ assistant, scope, text });
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Recover context from an AI assistant</p>
        <p className="max-w-2xl text-xs leading-5 text-subtle">
          Choose both the assistant and the place where the work context actually lives. Understudy changes the recovery prompt to match that boundary instead of sending the same generic prompt every time.
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">1</span>
          <p className="text-sm font-medium">Choose the assistant</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {AI_ASSISTANTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setAssistant(item); setCopied(false); }}
              data-ui-action="nav"
              aria-pressed={assistant === item}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                assistant === item
                  ? "border-accent/20 bg-accent-soft text-foreground shadow-sm"
                  : "border-border bg-card text-muted hover:bg-card-hover hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">2</span>
          <p className="text-sm font-medium">Choose where the context lives</p>
        </div>
        <div className="mt-3 grid gap-2 pl-8 sm:grid-cols-2">
          {AI_CONTEXT_SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setScope(item.id); setCopied(false); }}
              data-ui-action="nav"
              aria-pressed={scope === item.id}
              className={`rounded-xl border p-3 text-left transition-colors ${
                scope === item.id ? "border-accent/20 bg-accent-soft" : "border-border bg-card hover:bg-card-hover"
              }`}
            >
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-subtle">{item.detail}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">3</span>
          <p className="text-sm font-medium">Copy the tailored prompt into {assistant}</p>
        </div>
        <div className="mt-3 pl-8">
          <div className="mb-2 rounded-lg border border-accent/15 bg-accent-soft px-3 py-2 text-[11px] leading-4 text-muted">
            Scope: <span className="font-medium text-foreground">{selectedScope.label}</span>. Changing the assistant or scope regenerates the prompt below.
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5 text-subtle">{prompt}</pre>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-faint">
              The prompt limits recovery to the selected context boundary and requires the assistant to admit when that history is not accessible.
            </p>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-card px-3 text-xs font-medium text-muted hover:bg-card-hover"
            >
              {copied ? <IconCheck className="h-4 w-4 text-ok" /> : null}
              {copied ? "Copied" : "Copy tailored prompt"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">4</span>
          <p className="text-sm font-medium">Paste the assistant&apos;s response</p>
        </div>
        <div className="mt-3 pl-8">
          <textarea
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            rows={10}
            placeholder={`Paste the ${selectedScope.label.toLowerCase()} recovery from ${assistant} here…`}
            className="w-full rounded-lg border border-border bg-card p-3 text-sm leading-6 outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-4 text-faint">
              Understudy records which assistant and context boundary produced this evidence so the provenance remains visible during review.
            </p>
            <button
              type="button"
              disabled={responseText.trim().length < 80 || busy}
              onClick={() => void importContext()}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-35"
            >
              <IconSpark /> {busy ? "Importing…" : "Import AI context"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
