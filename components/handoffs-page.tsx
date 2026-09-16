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
} from "@/lib/personal-workspace";
import { blockingCriticalGaps } from "@/lib/interview-priority";
import { IconCheck, IconChevronRight, IconPlus } from "./icons";
import { CloudAccountControl } from "./cloud-account-control";

function statusFor(workspace: PersonalWorkspace) {
  const evidence = workspace.transition.sources.filter((source) => source.kind !== "interview" || source.provider === "Source clarification");
  const reviewComplete = evidence.length > 0 && evidence.every((source) => workspace.reviewedSourceIds.includes(source.id));
  const critical = blockingCriticalGaps(workspace.transition.gaps, workspace.interviewGapStates ?? {});
  if (!workspace.evidenceCollectionComplete || !workspace.roleEvidence) return "Collecting evidence";
  if (!reviewComplete) return "Reviewing reconstruction";
  if (!workspace.interviewCompletedAt) {
    if (critical.length) return `Filling gaps · ${critical.length} critical`;
    return "Gap review in progress";
  }
  if (workspace.successorReview?.status === "accepted") return "Handoff complete";
  if (workspace.successorReview) return "Successor review in progress";
  return "Ready for successor review";
}

export function HandoffsPage() {
  const reducedMotion = useReducedMotion();
  const [workspaces, setWorkspaces] = useState<PersonalWorkspace[]>([]);
  const [currentId, setCurrentId] = useState("");

  useEffect(() => {
    const refresh = () => {
      const identity = getIdentity();
      setWorkspaces(loadWorkspaces(identity.id));
      setCurrentId(getCurrentWorkspace(identity.id)?.id ?? "");
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>Understudy</Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-subtle sm:inline">Home</span>
            <CloudAccountControl compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-9 lg:px-8 lg:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">My handoffs</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Every transition, in one place.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Open a handoff to continue exactly where it stopped, or start another one without mixing evidence between people.</p>
          </div>
          <Link href="/new" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconPlus /> New handoff</Link>
        </div>

        {sorted.length ? (
          <div className="mt-8 space-y-3">
            {sorted.map((workspace, index) => {
              const active = workspace.id === currentId;
              const accepted = workspace.successorReview?.status === "accepted";
              const sourceCount = workspace.transition.sources.filter((source) => source.kind !== "interview" || source.provider === "Source clarification").length;
              return (
                <motion.button
                  key={workspace.id}
                  type="button"
                  onClick={() => open(workspace)}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : index * 0.035 }}
                  className="group grid w-full gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-border-strong hover:bg-card-hover sm:grid-cols-[minmax(0,1fr)_200px_24px] sm:items-center"
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
                  <div className="sm:text-right"><p className="text-sm font-medium text-muted">{statusFor(workspace)}</p><p className="mt-1 text-xs text-subtle">{sourceCount} evidence source{sourceCount === 1 ? "" : "s"}</p></div>
                  <IconChevronRight className="hidden text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted sm:block" />
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center">
            <h2 className="text-lg font-medium">No handoffs yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create one handoff per person or role transition. Understudy will keep each evidence set isolated.</p>
            <Link href="/new" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white"><IconPlus /> Create first handoff</Link>
          </div>
        )}
      </main>
    </div>
  );
}
