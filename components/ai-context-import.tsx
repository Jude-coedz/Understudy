"use client";

import { useMemo, useState } from "react";
import type { Transition } from "@/data/v2-demo";
import {
  AI_ASSISTANTS,
  buildAIContextRecoveryPrompt,
  type AIContextAssistant,
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
  onImport: (input: { assistant: AIContextAssistant; text: string }) => Promise<void>;
}) {
  const [assistant, setAssistant] = useState<AIContextAssistant>("ChatGPT");
  const [responseText, setResponseText] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(
    () => buildAIContextRecoveryPrompt({ transition, primarySourceTitles, knownWorkAreas }),
    [transition, primarySourceTitles, knownWorkAreas],
  );

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function importContext() {
    const text = responseText.trim();
    if (text.length < 80 || busy) return;
    await onImport({ assistant, text });
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Recover context from an AI assistant</p>
        <p className="max-w-2xl text-xs leading-5 text-subtle">
          Use an assistant you already worked with to recover decisions, rationale, recurring work, and lessons that may never have made it into formal documents. Understudy imports the result as lower-confidence AI-recovered evidence, not primary truth.
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">1</span>
          <p className="text-sm font-medium">Choose where the context lives</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 pl-8">
          {AI_ASSISTANTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAssistant(item)}
              className={`rounded-lg px-3 py-2 text-xs transition-colors ${
                assistant === item
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted hover:bg-card-hover"
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
          <p className="text-sm font-medium">Copy the recovery prompt into {assistant}</p>
        </div>
        <div className="mt-3 pl-8">
          <div className="rounded-lg border border-border bg-card p-3">
            <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5 text-subtle">{prompt}</pre>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-4 text-faint">
              The prompt tells the assistant not to invent missing history and not to include credentials or unrelated personal information.
            </p>
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-card px-3 text-xs font-medium text-muted hover:bg-card-hover"
            >
              {copied ? <IconCheck className="h-4 w-4 text-ok" /> : null}
              {copied ? "Copied" : "Copy recovery prompt"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted">3</span>
          <p className="text-sm font-medium">Paste the assistant&apos;s response</p>
        </div>
        <div className="mt-3 pl-8">
          <textarea
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            rows={10}
            placeholder={`Paste the recovered work context from ${assistant} here…`}
            className="w-full rounded-lg border border-border bg-card p-3 text-sm leading-6 outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-4 text-faint">
              Understudy will extract useful context, mark the source AI-recovered, and keep consequential claims open for verification when needed.
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
