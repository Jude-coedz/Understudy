"use client";

import Link from "next/link";
import { CloudAccountControl } from "./cloud-account-control";
import { AskView } from "./ask-view";

export function FocusedAskPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>Understudy</Link>
          <div className="flex items-center gap-2">
            <Link href="/handoffs" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">My handoffs</Link>
            <Link href="/workspace" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Back to handoff</Link>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>
      <AskView />
    </div>
  );
}
