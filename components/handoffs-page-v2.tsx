"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  getCurrentWorkspace,
  getIdentity,
  loadWorkspaces,
  setCurrentWorkspace,
  type PersonalWorkspace,
  type UnderstudyIdentity,
} from "@/lib/personal-workspace";
import { blockingCriticalGaps } from "@/lib/interview-priority";
import { IconCheck, IconChevronRight, IconPlus } from "./icons";
import { UnderstudyMark } from "./understudy-mark";
import { CloudAccountControl } from "./cloud-account-control";

function statusFor(workspace: PersonalWorkspace) {
  const critical = blockingCriticalGaps(workspace.transition.gaps, workspace.interviewGapStates ?? {});
  if (!workspace.evidenceCollectionComplete || !workspace.roleEvidence) return "Collecting evidence";
  if (!workspace.reviewedSourceIds.length) return "Reviewing reconstruction";
  if (!workspace.interviewCompletedAt) return critical.length ? `Filling gaps · ${critical.length} critical` : "Finishing gap review";
  if (workspace.successorReview?.status === "accepted") return "Handoff complete";
  if (workspace.successorReview) return "Successor review in progress";
  return "Ready for successor review";
}

export function HandoffsPageV2() {
  const reducedMotion = useReducedMotion();
  const [workspaces, setWorkspaces] = useState<PersonalWorkspace[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [identity, setIdentity] = useState<UnderstudyIdentity | null>(null);

  useEffect(() => {
    const refresh = () => {
      const nextIdentity = getIdentity();
      setIdentity(nextIdentity);
      setWorkspaces(loadWorkspaces(nextIdentity.id));
      setCurrentId(getCurrentWorkspace(nextIdentity.id)?.id ?? "");
    };
    refresh();
    window.addEventListener("understudy:workspace-saved", refresh);
    window.addEventListener("understudy:cloud-hydrated", refresh);
    window.addEventListener("understudy:identity-changed", refresh);
    return () => {
      window.removeEventListener("understudy:workspace-saved", refresh);
      window.removeEventListener("understudy:cloud-hydrated", refresh);
      window.removeEventListener("understudy:identity-changed", refresh);
    };
  }, []);

  const sorted = useMemo(
    () => [...workspaces].sort((a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf()),
    [workspaces],
  );

  function open(workspace: PersonalWorkspace) {
    setCurrentWorkspace(workspace.id, workspace.ownerId);
    window.location.assign("/workspace");
  }

  const accountMode = identity?.provider === "account";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]"><UnderstudyMark size={32} />Understudy</Link>
          <div className="flex items-center gap-2"><Link href="/demo" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover sm:inline-flex">Guided demo</Link><Link href="/" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Home</Link><CloudAccountControl compact /></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-9 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">My handoffs</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Every handoff, one clear place.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Each person has a separate evidence set, reconstruction, gap review, and successor verification.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/demo" className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted sm:hidden">See demo</Link><Link href="/new" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconPlus /> New handoff</Link></div>
        </div>

        <div className={`mt-6 rounded-2xl border p-4 ${accountMode ? "border-ok/20 bg-ok/5" : "border-border bg-card"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{accountMode ? "Synced to your account" : "Private to this browser"}</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">
                {accountMode
                  ? `These handoffs can load on another device only after signing into the same${identity?.email ? ` ${identity.email}` : ""} account. The app URL itself does not expose them.`
                  : "These handoffs live in this browser's local storage. Opening the same Understudy URL on another computer will not show them."}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-subtle">{accountMode ? "Account private" : "Browser only"}</span>
          </div>
        </div>

        {sorted.length ? (
          <div className="mt-8 space-y-3">
            {sorted.map((workspace, index) => {
              const active = workspace.id === currentId;
              const accepted = workspace.successorReview?.status === "accepted";
              const evidenceCount = workspace.transition.sources.filter((source) => source.kind !== "interview").length;
              return (
                <motion.button
                  key={workspace.id}
                  type="button"
                  onClick={() => open(workspace)}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : index * 0.03 }}
                  className="group grid w-full gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-border-strong hover:bg-card-hover sm:grid-cols-[minmax(0,1fr)_210px_24px] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-medium">{workspace.transition.person}</h2>
                      {active && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">Current</span>}
                      {accepted && <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok"><IconCheck className="h-3 w-3" />Complete</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{workspace.transition.role} → {workspace.transition.successor}</p>
                    <p className="mt-2 text-xs text-subtle">Target {workspace.transition.targetDate} · updated {new Date(workspace.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</p>
                  </div>
                  <div className="sm:text-right"><p className="text-sm font-medium text-muted">{statusFor(workspace)}</p><p className="mt-1 text-xs text-subtle">{evidenceCount} evidence source{evidenceCount === 1 ? "" : "s"}</p></div>
                  <IconChevronRight className="hidden text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:block" />
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
            <h2 className="text-lg font-medium">No handoffs yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create a handoff for the first person whose work is changing hands.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/demo" className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-muted">Watch the demo first</Link><Link href="/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconPlus /> Create first handoff</Link></div>
          </div>
        )}
      </main>
    </div>
  );
}
