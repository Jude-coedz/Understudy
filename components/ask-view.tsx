"use client";

import { useState, type KeyboardEvent } from "react";
import { BriefingView } from "./briefing";
import { Explain } from "./explain";
import { useHasHydrated, useKb } from "@/lib/store";
import type { Briefing } from "@/lib/types";

const SAMPLE = "Who shouldn’t we use for urgent jobs?";

export function AskView() {
  const hydrated = useHasHydrated();
  const { people, records } = useKb();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setText("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, records, people }),
      });
      if (res.ok) setBriefing((await res.json()) as Briefing);
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(text);
    }
  }

  if (!hydrated) {
    return <div className="p-6 text-muted">Loading ask…</div>;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-44px)] max-w-2xl flex-col px-4 py-6">
      <h1 className="text-[18px] font-medium tracking-tight">Ask</h1>
      <p className="mt-1 text-[12.5px] text-muted">
        <Explain term="Brief">
          A short answer with provenance. Not a list of search hits. Disagreements
          stay as both sides.
        </Explain>
        , don’t search.
      </p>

      <div className="mt-6 flex-1">
        {briefing ? (
          <BriefingView briefing={briefing} />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted">
            Try{" "}
            <button
              type="button"
              className="text-accent underline-offset-2 hover:underline"
              onClick={() => void send(SAMPLE)}
            >
              {SAMPLE}
            </button>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-6 border-t border-border bg-background pt-3 pb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={3}
          placeholder="Ask how the shop actually runs. Enter to send, Shift+Enter for a newline."
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-relaxed"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => void send(text)}
            className="rounded-md bg-accent px-3 py-1 text-[12px] text-white disabled:opacity-40"
          >
            {busy ? "Briefing…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
