"use client";

import { useEffect, useState } from "react";
import { clearIdentity, getIdentity } from "@/lib/personal-workspace";
import {
  getSupabaseSession,
  getSupabaseUser,
  loadSupabaseConfig,
  signInWithSupabaseGoogle,
  signOutSupabase,
  type SupabaseUser,
} from "@/lib/supabase-browser";

type Props = { compact?: boolean };

export function CloudAccountControl({ compact = false }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      const config = await loadSupabaseConfig();
      if (!active) return;
      setConfigured(config.configured);
      const session = await getSupabaseSession();
      const next = await getSupabaseUser(session);
      if (active) setUser(next);
    }
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("understudy:auth-changed", listener);
    return () => {
      active = false;
      window.removeEventListener("understudy:auth-changed", listener);
    };
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithSupabaseGoogle();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start account sign-in.");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    await signOutSupabase();
    clearIdentity();
    setBusy(false);
    window.location.assign("/");
  }

  if (configured === false) {
    return compact ? null : (
      <p className="text-xs leading-5 text-subtle">Account sync is not configured on this deployment yet.</p>
    );
  }

  if (user) {
    const label =
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      user.email ||
      getIdentity().name;
    return (
      <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
        <span className="max-w-[180px] truncate text-xs text-muted">{label}</span>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted hover:bg-card-hover disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy || configured === null}
        className="rounded-lg border border-border-strong bg-card px-3 py-2 text-xs font-medium text-muted hover:bg-card-hover hover:text-foreground disabled:opacity-50"
      >
        {busy ? "Connecting…" : "Sign in to sync"}
      </button>
      {!compact && <p className="mt-1.5 text-[11px] leading-4 text-subtle">Sync transitions across devices with your account.</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
