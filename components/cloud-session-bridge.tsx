"use client";

import { useEffect } from "react";
import { hydrateAuthenticatedWorkspaces, pushWorkspaceToCloud } from "@/lib/cloud-workspaces";
import type { PersonalWorkspace } from "@/lib/personal-workspace";
import { getSupabaseSession } from "@/lib/supabase-browser";

export function CloudSessionBridge() {
  useEffect(() => {
    let active = true;

    async function hydrate() {
      const session = await getSupabaseSession();
      if (!active || !session) return;
      try {
        await hydrateAuthenticatedWorkspaces();
      } catch (error) {
        console.warn("Understudy cloud hydration failed", error);
      }
    }

    function onAuthChanged() {
      void hydrate();
    }

    function onWorkspaceSaved(event: Event) {
      const workspace = (event as CustomEvent<PersonalWorkspace>).detail;
      if (!workspace) return;
      void pushWorkspaceToCloud(workspace).catch((error) => {
        console.warn("Understudy workspace sync failed", error);
      });
    }

    void hydrate();
    window.addEventListener("understudy:auth-changed", onAuthChanged);
    window.addEventListener("understudy:workspace-saved", onWorkspaceSaved);
    return () => {
      active = false;
      window.removeEventListener("understudy:auth-changed", onAuthChanged);
      window.removeEventListener("understudy:workspace-saved", onWorkspaceSaved);
    };
  }, []);

  return null;
}
