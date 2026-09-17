"use client";

import { useEffect, useState } from "react";
import { getCurrentWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { EmbeddedAskPanel } from "./embedded-ask-panel";

export function AskView() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  if (!loaded) {
    return <div className="mx-auto max-w-3xl px-5 py-12"><div className="h-40 animate-pulse rounded-2xl border border-border bg-card" /></div>;
  }

  if (!workspace) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Choose a handoff first.</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Ask Understudy works inside one handoff so answers never mix evidence between people.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => window.location.assign("/handoffs")} className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted">My handoffs</button>
          <button onClick={() => window.location.assign("/new")} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">New handoff</button>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-subtle">{workspace.transition.person} · {workspace.transition.role}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Ask about this handoff.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Understudy answers from this handoff's evidence, workspace facts, and reviewed context. Unsupported claims stay unknown.</p>
      </div>
      <EmbeddedAskPanel workspace={workspace} heading={`Ask about ${workspace.transition.person}'s handoff`} />
    </main>
  );
}
