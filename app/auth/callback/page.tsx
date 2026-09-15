"use client";

import { useEffect, useState } from "react";
import { hydrateAuthenticatedWorkspaces } from "@/lib/cloud-workspaces";
import { completeSupabaseOAuthFromHash } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing account sign-in…");

  useEffect(() => {
    let active = true;
    async function finish() {
      try {
        await completeSupabaseOAuthFromHash(window.location.hash);
        if (!active) return;
        setMessage("Account connected. Syncing your workspaces…");
        await hydrateAuthenticatedWorkspaces();
        if (!active) return;
        window.history.replaceState({}, "", "/auth/callback");
        window.location.replace("/workspace");
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Could not finish account sign-in.");
      }
    }
    void finish();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-white">U</div>
        <h1 className="mt-4 text-lg font-semibold">Understudy account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
      </div>
    </main>
  );
}
