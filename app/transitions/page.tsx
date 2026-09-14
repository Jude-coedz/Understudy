import Link from "next/link";
import { Shell } from "@/components/shell";
import { transitions } from "@/data/v2-demo";
import { IconChevronRight, IconClock, IconPlus } from "@/components/icons";

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function TransitionsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1180px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">Transitions</p>
            <h1 className="mt-1 text-[27px] font-semibold tracking-[-0.04em]">Move ownership without losing context.</h1>
            <p className="mt-2 max-w-xl text-[11px] leading-5 text-muted">
              Each transition collects evidence, reconstructs work, interviews for missing context, and verifies that the next owner can continue.
            </p>
          </div>
          <Link href="/transitions/maya-okafor" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[11px] font-medium text-white hover:bg-accent-hover">
            <IconPlus /> New transition
          </Link>
        </div>

        <div className="mb-4 flex items-center gap-2 text-[9.5px] text-subtle">
          <span className="rounded-md border border-border bg-card px-2 py-1 text-foreground">Active {transitions.length}</span>
          <span className="rounded-md border border-transparent px-2 py-1">Completed 12</span>
          <span className="rounded-md border border-transparent px-2 py-1">All 15</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_120px_160px_150px_22px] gap-4 border-b border-border bg-background/50 px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.08em] text-faint sm:grid">
            <span>Person / role</span><span>Target</span><span>Successor</span><span>Readiness</span><span />
          </div>
          {transitions.map((transition, index) => (
            <Link
              key={transition.id}
              href={`/transitions/${transition.id}`}
              className={`group grid gap-4 px-4 py-4 hover:bg-card-hover sm:grid-cols-[minmax(0,1.3fr)_120px_160px_150px_22px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[10px] font-semibold text-muted">{transition.initials}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[11.5px] font-medium">{transition.person}</p>
                    <span className={`h-1.5 w-1.5 rounded-full ${transition.status === "Ready for review" ? "bg-ok" : transition.status === "Needs attention" ? "bg-warning" : "bg-accent"}`} />
                  </div>
                  <p className="mt-0.5 truncate text-[9.5px] text-subtle">{transition.role} · {transition.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted"><IconClock className="h-3.5 w-3.5 text-subtle" />{transition.targetDate.replace(", 2026", "")}</div>
              <div className="flex items-center gap-2 text-[10px] text-muted"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-[8px]">{transition.successorInitials}</span><span className="truncate">{transition.successor}</span></div>
              <div>
                <div className="mb-1.5 flex justify-between font-mono text-[9px] text-subtle"><span>{transition.status}</span><span>{transition.readiness}%</span></div>
                <Progress value={transition.readiness} />
              </div>
              <IconChevronRight className="hidden text-faint group-hover:text-muted sm:block" />
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
