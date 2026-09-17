"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { isDismissedInterviewGap } from "@/lib/interview-priority";
import { EmbeddedAskPanel } from "./embedded-ask-panel";
import { IconCheck, IconFile, IconSpark } from "./icons";

export function HandoffRecordPage() {
  const reducedMotion = useReducedMotion();
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAsk, setShowAsk] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setWorkspace(getCurrentWorkspace());
      setLoaded(true);
    };
    refresh();
    window.addEventListener("understudy:cloud-hydrated", refresh);
    window.addEventListener("understudy:workspace-saved", refresh);
    return () => {
      window.removeEventListener("understudy:cloud-hydrated", refresh);
      window.removeEventListener("understudy:workspace-saved", refresh);
    };
  }, []);

  const followups = useMemo(() => workspace?.transition.gaps.filter((gap) => !isDismissedInterviewGap(workspace.interviewGapStates[gap.question])) ?? [], [workspace]);

  if (!loaded) {
    return <div className="min-h-screen bg-background"><div className="mx-auto max-w-4xl px-5 py-16"><div className="h-52 animate-pulse rounded-2xl border border-border bg-card" /></div></div>;
  }

  if (!workspace) {
    return <div className="min-h-screen bg-background px-5 py-20 text-center text-foreground"><h1 className="text-2xl font-semibold">No handoff selected.</h1><p className="mt-2 text-sm text-muted">Open a handoff first.</p><Link href="/handoffs" className="mt-5 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white">My handoffs</Link></div>;
  }

  const transition = workspace.transition;
  const accepted = workspace.successorReview?.status === "accepted";
  const evidence = transition.sources.filter((source) => source.kind !== "interview");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-xs font-semibold text-white">U</span>Understudy</Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowAsk((value) => !value)} className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium sm:inline-flex ${showAsk ? "border-accent/25 bg-accent-soft text-accent" : "border-border bg-card text-muted hover:bg-card-hover"}`}><IconSpark className="h-4 w-4" />Ask Understudy</button>
            <Link href="/workspace" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">Open handoff</Link>
            <Link href="/handoffs" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover">My handoffs</Link>
          </div>
        </div>
      </header>

      <motion.main initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Handoff record</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{transition.person} → {transition.successor}</h1><p className="mt-2 text-sm text-muted">{transition.role} · {transition.department}</p></div>
          <span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-medium sm:self-auto ${accepted ? "bg-ok/10 text-ok" : "bg-warning/10 text-warning"}`}>{accepted && <IconCheck className="h-3.5 w-3.5" />}{accepted ? "Handoff complete" : "Handoff in progress"}</span>
        </div>

        <AnimatePresence initial={false}>
          {showAsk && <motion.div initial={reducedMotion ? false : { opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }} className="mt-6 overflow-hidden"><EmbeddedAskPanel workspace={workspace} onClose={() => setShowAsk(false)} heading="Ask this completed handoff" /></motion.div>}
        </AnimatePresence>

        <section className="mt-7 rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium">Role overview</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{transition.summary}</p></section>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5"><p className="text-sm font-medium">Active work</p><div className="mt-3 space-y-3">{transition.projects.length ? transition.projects.map((project) => <div key={project.name}><p className="text-sm font-medium">{project.name}</p><p className="mt-1 text-xs leading-5 text-subtle">{project.state} · {project.ownership}</p></div>) : <p className="text-sm text-subtle">No active work reconstructed.</p>}</div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><p className="text-sm font-medium">Continuity risks</p><div className="mt-3 space-y-3">{transition.risks.length ? transition.risks.map((risk) => <div key={risk.title}><p className="text-sm font-medium">{risk.title}</p><p className="mt-1 text-xs leading-5 text-subtle">{risk.detail}</p></div>) : <p className="text-sm text-subtle">No material continuity risks recorded.</p>}</div></section>
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm font-medium">Evidence set</p><span className="text-xs text-subtle">{evidence.length} source{evidence.length === 1 ? "" : "s"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{evidence.slice(0, 12).map((source) => <div key={source.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5"><IconFile className="h-4 w-4 shrink-0 text-muted" /><p className="min-w-0 truncate text-xs text-muted">{source.title}</p></div>)}</div>{evidence.length > 12 && <p className="mt-3 text-xs text-subtle">+ {evidence.length - 12} more sources retained in the workspace.</p>}</section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5"><p className="text-sm font-medium">Open follow-ups</p><div className="mt-3 space-y-2">{followups.length ? followups.map((gap) => <p key={gap.question} className="text-sm leading-6 text-muted">• {gap.question}</p>) : <p className="text-sm text-subtle">No open follow-ups.</p>}</div></section>

        {workspace.successorReview && <section className="mt-5 rounded-2xl border border-border bg-card p-5"><p className="text-sm font-medium">Successor verification</p><p className="mt-2 text-sm leading-6 text-muted">Status: {workspace.successorReview.status === "accepted" ? "Accepted" : workspace.successorReview.status === "changes-requested" ? "Changes requested" : "Pending"}</p>{workspace.successorReview.acceptedAt && <p className="mt-1 text-xs text-subtle">Accepted {new Date(workspace.successorReview.acceptedAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</p>}{workspace.successorReview.notes && <p className="mt-3 rounded-lg bg-background p-3 text-sm leading-6 text-muted">{workspace.successorReview.notes}</p>}</section>}

        <div className="mt-6 sm:hidden"><button type="button" onClick={() => setShowAsk((value) => !value)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-muted"><IconSpark className="h-4 w-4" />Ask Understudy</button></div>
      </motion.main>
    </div>
  );
}
