import Link from "next/link";
import { FocusedUtilityShell } from "@/components/focused-utility-shell";
import { transitions } from "@/data/v2-demo";
import { IconChevronRight, IconClock, IconPlus } from "@/components/icons";

export default function TransitionsPage() {
  return (
    <FocusedUtilityShell backHref="/" backLabel="Home">
      <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Example handoffs</p>
              <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-subtle">Demo data</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">See the handoff flow with fictional work.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Each example uses the same focused four-stage experience as a real handoff. No legacy dashboard or illustrative readiness score is required.</p>
          </div>
          <Link href="/new" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover"><IconPlus /> Start your own handoff</Link>
        </div>

        <div className="mb-4 text-xs text-subtle">{transitions.length} fictional scenario{transitions.length === 1 ? "" : "s"}</div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {transitions.map((transition, index) => (
            <Link key={transition.id} href={`/transitions/${transition.id}`} className={`group grid gap-4 px-5 py-5 hover:bg-card-hover sm:grid-cols-[minmax(0,1.3fr)_120px_160px_150px_22px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background text-[11px] font-semibold text-muted">{transition.initials}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{transition.person}</p><p className="mt-0.5 truncate text-xs text-subtle">{transition.role} · {transition.type}</p></div></div>
              <div className="flex items-center gap-1.5 text-xs text-muted"><IconClock className="h-3.5 w-3.5 text-subtle" />{transition.targetDate.replace(", 2026", "")}</div>
              <div className="text-xs text-muted">{transition.successor}</div>
              <span className="w-fit rounded-md border border-accent/20 bg-accent-soft px-2 py-1 text-xs text-accent">Guided walkthrough</span>
              <IconChevronRight className="hidden text-faint group-hover:text-muted sm:block" />
            </Link>
          ))}
        </div>
      </div>
    </FocusedUtilityShell>
  );
}
