import Link from "next/link";
import { continuityRisks, transitions } from "@/data/v2-demo";
import {
  IconAlert,
  IconChevronRight,
  IconClock,
  IconPlus,
  IconTransition,
} from "./icons";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "Ready for review"
      ? "bg-ok"
      : status === "Needs attention"
        ? "bg-warning"
        : "bg-accent";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}

export function DashboardView() {
  const critical = continuityRisks.filter((risk) => risk.score >= 75).length;
  const openQuestions = transitions.reduce(
    (sum, transition) => sum + transition.gaps.length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 py-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
            Monday, September 14
          </p>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[32px]">
            Work that can survive a handoff.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-muted">
            Track active transitions, recover context from the tools where work happened,
            and close knowledge gaps before ownership changes.
          </p>
        </div>
        <Link
          href="/transitions/maya-okafor"
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg bg-accent px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent-hover sm:self-auto"
        >
          <IconPlus />
          New transition
        </Link>
      </div>

      <section className="mb-8 grid border-y border-border sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Active transitions", String(transitions.length), "2 need action"],
          ["Continuity risks", String(critical), "Critical areas"],
          ["Open questions", String(openQuestions + 7), "Across handoffs"],
          ["Average readiness", "74%", "+8% this week"],
        ].map(([label, value, note], index) => (
          <div
            key={label}
            className={`px-0 py-5 sm:px-5 ${
              index > 0 ? "border-t border-border sm:border-l sm:border-t-0" : ""
            }`}
          >
            <p className="text-[11px] text-subtle">{label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-[28px] font-semibold tracking-[-0.05em]">{value}</p>
              <span className="text-[10px] text-faint">{note}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-medium">Active transitions</h2>
              <p className="mt-0.5 text-[11px] text-subtle">
                Ownership changes currently being prepared.
              </p>
            </div>
            <Link href="/transitions" className="text-[11px] text-muted hover:text-foreground">
              View all
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {transitions.map((transition, index) => (
              <Link
                key={transition.id}
                href={`/transitions/${transition.id}`}
                className={`group grid gap-4 px-4 py-4 transition-colors hover:bg-card-hover sm:grid-cols-[minmax(0,1.4fr)_120px_150px_20px] sm:items-center ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[10px] font-semibold text-muted">
                    {transition.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[12.5px] font-medium">{transition.person}</p>
                      <span className="hidden items-center gap-1.5 text-[10px] text-subtle md:flex">
                        <StatusDot status={transition.status} />
                        {transition.status}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-subtle">
                      {transition.role} · {transition.type}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-faint">Target</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                    <IconClock className="h-3.5 w-3.5 text-subtle" />
                    {transition.targetDate.replace(", 2026", "")}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-subtle">Readiness</span>
                    <span className="font-mono text-muted">{transition.readiness}%</span>
                  </div>
                  <ProgressBar value={transition.readiness} />
                </div>

                <IconChevronRight className="hidden text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:block" />
              </Link>
            ))}
          </div>
        </section>

        <aside>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-medium">Continuity watch</h2>
              <p className="mt-0.5 text-[11px] text-subtle">Where work depends on one person.</p>
            </div>
            <Link href="/continuity" className="text-[11px] text-muted hover:text-foreground">
              Inspect
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {continuityRisks.map((risk, index) => (
              <div key={risk.area} className={`${index > 0 ? "border-t border-border" : ""} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{risk.area}</p>
                    <p className="mt-0.5 text-[10px] text-subtle">
                      {risk.team} · {risk.owner}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] ${
                      risk.score >= 80
                        ? "border-danger/25 bg-danger/10 text-[#f08a95]"
                        : "border-warning/25 bg-warning/10 text-[#e0bd72]"
                    }`}
                  >
                    {risk.score}
                  </span>
                </div>
                <p className="mt-2.5 text-[10.5px] leading-4 text-muted">{risk.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3 rounded-lg border border-border bg-background px-3.5 py-3">
            <IconAlert className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-[11px] font-medium">Understudy found 2 critical dependencies</p>
              <p className="mt-1 text-[10px] leading-4 text-subtle">
                Start a transition early enough to interview the owner while they are still available.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
