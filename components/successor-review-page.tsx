"use client";

import Link from "next/link";
import { CloudAccountControl } from "./cloud-account-control";
import { SuccessorReviewPanelV2 } from "./successor-review-panel-v2";

export function SuccessorReviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</Link>
            <div><p className="text-sm font-medium">Successor review</p><p className="text-xs text-subtle">Final verification</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/handoffs" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted hover:bg-card-hover sm:inline-flex">My handoffs</Link>
            <a href="/workspace" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Back to handoff</a>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>
      <SuccessorReviewPanelV2 />
    </div>
  );
}
