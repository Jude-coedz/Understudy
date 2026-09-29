"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UnderstudyMark } from "./understudy-mark";
import { CloudAccountControl } from "./cloud-account-control";
import { AskView } from "./ask-view";

export function FocusedAskPage() {
  const [returnTo, setReturnTo] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnTo(params.get("returnTo") === "/review" ? "/review" : "");
  }, []);

  const returnLabel = returnTo ? "Back to successor review" : "Back to handoff";

  return (
    <div className="understudy-utility-shell min-h-screen bg-background text-foreground">
      <header className="understudy-topbar sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]"><UnderstudyMark size={32} />Understudy</Link>
          <div className="flex items-center gap-2">
            {!returnTo && <Link href="/handoffs" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">My handoffs</Link>}
            <Link href={returnTo || "/workspace"} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">{returnLabel}</Link>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>
      {returnTo && (
        <div className="mx-auto max-w-5xl px-5 pt-5 lg:px-8">
          <div className="rounded-xl border border-accent/15 bg-accent-soft/45 px-4 py-3 text-xs leading-5 text-muted">
            <strong className="font-semibold text-foreground">Successor review context.</strong> You are still reviewing the handoff as the next owner. Asking a question here does not switch you into the current owner&apos;s workflow.
          </div>
        </div>
      )}
      <AskView />
    </div>
  );
}
