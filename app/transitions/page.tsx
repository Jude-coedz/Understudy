import Link from "next/link";
import { Shell } from "@/components/shell";
import { transitions } from "@/data/v2-demo";
import { IconChevronRight, IconClock, IconPlus } from "@/components/icons";

export default function TransitionsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1180px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Example transitions</p>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-subtle">Demo data</span>
            </div>
            <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.04em]">See different handoff scenarios.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              These are fictional examples for exploring Understudy. They are not real employee records, and the legacy fixture values in advanced workspace views are illustrative rather than measured scores.
            </p>
          </div>
          <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover">
            <IconPlus /> Start your own transition
          </Link>
        </div>

        <div className="mb-4 text-xs text-subtle">
          {transitions.length} fictional scenario{transitions.length === 1 ? "" : "s"}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_120px_160px_150px_22px] gap-4 border-b border-border bg-background/50 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint sm:grid">
            <span>Person / role</span><span>Target</span><span>Successor</span><span>Demo view</span><span />
          </div>
          {transitions.map((transition, index) => {
            const guided = transition.id === "maya-okafor";
            return (
              <Link
                key={transition.id}
                href={`/transitions/${transition.id}${guided ? "" : "?mode=workspace"}`}
                className={`group grid gap-4 px-4 py-4 hover:bg-card-hover sm:grid-cols-[minmax(0,1.3fr)_120px_160px_150px_22px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[10px] font-semibold text-muted">{transition.initials}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transition.person}</p>
                    <p className="mt-0.5 truncate text-xs text-subtle">{transition.role} · {transition.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted"><IconClock className="h-3.5 w-3.5 text-subtle" />{transition.targetDate.replace(", 2026", "")}</div>
                <div className="flex items-center gap-2 text-xs text-muted"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-[8px]">{transition.successorInitials}</span><span className="truncate">{transition.successor}</span></div>
                <span className={`w-fit rounded-md border px-2 py-1 text-xs ${guided ? "border-accent/20 bg-accent-soft text-accent" : "border-border bg-background text-subtle"}`}>
                  {guided ? "Guided walkthrough" : "Advanced workspace"}
                </span>
                <IconChevronRight className="hidden text-faint group-hover:text-muted sm:block" />
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
