import Link from "next/link";
import type { ReactNode } from "react";
import { CloudAccountControl } from "./cloud-account-control";
import { UnderstudyMark } from "./understudy-mark";

export function FocusedUtilityShell({
  children,
  backHref = "/workspace",
  backLabel = "Back to handoff",
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]"><UnderstudyMark size={32} />Understudy</Link>
          <div className="flex items-center gap-2">
            <Link href="/handoffs" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover sm:inline-flex">My handoffs</Link>
            <Link href={backHref} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">{backLabel}</Link>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
