"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCurrentWorkspace,
  type PersonalWorkspace,
} from "@/lib/personal-workspace";

type Screen = "sources" | "map" | "interview" | "handoff";

type DraftState = {
  dirty: boolean;
  missing: "title" | "body" | null;
};

function visible(element: Element) {
  const node = element as HTMLElement;
  return Boolean(node.offsetParent);
}

function detectScreen(): Screen {
  const headings = Array.from(document.querySelectorAll("h2"))
    .filter(visible)
    .map((item) => item.textContent?.trim().toLowerCase() ?? "");
  if (headings.some((text) => text.includes("adaptive interview") || text.includes("nothing else to answer"))) return "interview";
  if (headings.some((text) => text.includes("handoff draft"))) return "handoff";
  if (headings.some((text) => text === "reconstruction")) return "map";
  return "sources";
}

function detectDraft(): DraftState {
  const title = Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder="Source title"]')).find(visible);
  const body = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea")).find((item) => visible(item) && (item.placeholder.includes("Paste a PRD") || item.placeholder.includes("roadmap")));
  if (!title && !body) return { dirty: false, missing: null };
  const titleValue = title?.value.trim() ?? "";
  const bodyValue = body?.value.trim() ?? "";
  const dirty = Boolean(titleValue || bodyValue);
  if (!dirty) return { dirty: false, missing: null };
  if (!titleValue) return { dirty: true, missing: "title" };
  if (bodyValue.length < 20) return { dirty: true, missing: "body" };
  return { dirty: true, missing: null };
}

function workspaceSnapshot() {
  return getCurrentWorkspace();
}

export function WorkspaceContextualGuide() {
  const [screen, setScreen] = useState<Screen>("sources");
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [draft, setDraft] = useState<DraftState>({ dirty: false, missing: null });
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => {
    function refresh() {
      setScreen(detectScreen());
      setWorkspace(workspaceSnapshot());
      setDraft(detectDraft());
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const timer = window.setInterval(refresh, 900);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!draft.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function captureNavigation(event: MouseEvent) {
      if (!draft.dirty) return;
      const target = event.target as HTMLElement | null;
      const actionable = target?.closest("a,button") as HTMLElement | null;
      if (!actionable) return;
      const text = actionable.textContent?.trim() ?? "";
      const isAnalyse = text.includes("Analyse and add");
      const isEvidenceControl = ["Paste text", "Upload file", "Google Drive", "Choose TXT, Markdown, JSON, or CSV"].some((label) => text.includes(label));
      if (isAnalyse || isEvidenceControl) return;

      if (draft.missing) {
        event.preventDefault();
        event.stopPropagation();
        setBlockedMessage(draft.missing === "title" ? "Finish the source title before leaving this draft, or clear the draft first." : "Add enough source content for Understudy to analyse it before moving away from this draft.");
        const selector = draft.missing === "title" ? 'input[placeholder="Source title"]' : "textarea";
        const field = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(visible);
        field?.focus();
        return;
      }

      const confirmed = window.confirm("You have an evidence draft that has not been analysed yet. Leave it anyway?");
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
        setBlockedMessage("Your evidence draft is still open. Analyse it before moving on, or clear the draft if you no longer need it.");
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", captureNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", captureNavigation, true);
    };
  }, [draft]);

  const guidance = useMemo(() => {
    const transition = workspace?.transition;
    const sources = transition?.sources ?? [];
    const evidenceSources = sources.filter((source) => source.kind !== "interview");
    const primary = evidenceSources.filter((source) => source.kind === "document" || source.kind === "github").length;
    const recovered = evidenceSources.filter((source) => source.kind === "ai-context").length;
    const unreviewed = evidenceSources.filter((source) => !workspace?.reviewedSourceIds.includes(source.id)).length;
    const critical = transition?.gaps.filter((gap) => gap.priority === "Critical" && workspace?.interviewGapStates[gap.question]?.status !== "not-relevant").length ?? 0;
    const open = transition?.gaps.filter((gap) => workspace?.interviewGapStates[gap.question]?.status !== "not-relevant").length ?? 0;

    if (screen === "sources") {
      if (!evidenceSources.length) {
        return {
          eyebrow: "Evidence",
          title: "Start with something that already exists",
          body: "Add one real work artifact. A PRD, roadmap, runbook, project note, Drive file, or recovered AI context is enough to begin.",
          next: "Understudy will reconstruct what that source supports, then ask whether there is more evidence before moving on.",
          meta: "0 sources yet",
        };
      }
      if (!workspace?.evidenceCollectionComplete) {
        return {
          eyebrow: "Evidence",
          title: `${evidenceSources.length} source${evidenceSources.length === 1 ? "" : "s"} collected. Is the role represented yet?`,
          body: `You currently have ${primary} primary source${primary === 1 ? "" : "s"}${recovered ? ` and ${recovered} AI-recovered source${recovered === 1 ? "" : "s"}` : ""}. One strong PRD can explain a project without explaining the whole role.`,
          next: "Add the remaining artifacts you already have. Only choose “That’s all I have” when this evidence set is representative of the work you are handing over.",
          meta: "Collection still open",
        };
      }
      return {
        eyebrow: "Evidence",
        title: "Evidence collection is marked complete",
        body: `${evidenceSources.length} source${evidenceSources.length === 1 ? "" : "s"} are in the handoff set. You can reopen collection at any time if another artifact turns up.`,
        next: unreviewed ? `Review ${unreviewed} source interpretation${unreviewed === 1 ? "" : "s"} next.` : "The reconstruction is ready for gap review.",
        meta: `${primary} primary · ${recovered} AI-recovered`,
      };
    }

    if (screen === "map") {
      return {
        eyebrow: "Reconstruction",
        title: unreviewed ? `Verify ${unreviewed} interpretation${unreviewed === 1 ? "" : "s"}` : "The current reconstruction has been reviewed",
        body: unreviewed ? "Understudy has inferred work areas, risks, and missing context from the evidence. Verification confirms that the source was interpreted correctly; it does not mean every claim is complete." : `The evidence currently leaves ${open} open handoff question${open === 1 ? "" : "s"}.`,
        next: unreviewed ? "Verify each source interpretation before starting the interview." : critical ? `${critical} critical gap${critical === 1 ? " remains" : "s remain"}. Continue to the focused interview.` : "No critical gap currently blocks the handoff.",
        meta: `${transition?.projects.length ?? 0} work areas · ${transition?.risks.length ?? 0} risks`,
      };
    }

    if (screen === "interview") {
      return {
        eyebrow: "Interview",
        title: critical ? `${critical} critical item${critical === 1 ? " needs" : "s need"} closure` : "Critical interview work is clear",
        body: critical ? "Only high-value evidence gaps should demand an answer. If you do not know something, park it for another person instead of guessing." : `${open} lower-priority question${open === 1 ? " remains" : "s remain"}, but they do not automatically block the handoff.`,
        next: critical ? "Answer, delegate, or explicitly classify the current focus set. One good answer may resolve multiple related gaps." : "You can preview the handoff and leave lower-priority context visible as open questions.",
        meta: `${open} open · ${critical} critical`,
      };
    }

    return {
      eyebrow: "Handoff",
      title: "Check whether the successor can actually continue the work",
      body: `The draft is built from ${sources.length} evidence item${sources.length === 1 ? "" : "s"}. Readiness is ${transition?.readiness ?? 0}%, but that score is not a substitute for successor review.`,
      next: "Use the draft to verify ownership, active work, risks, open questions, and source provenance before treating the transfer as complete.",
      meta: `${open} open question${open === 1 ? "" : "s"}`,
    };
  }, [screen, workspace]);

  if (!workspace) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden w-[340px] rounded-2xl border border-border-strong bg-card/95 p-4 shadow-2xl backdrop-blur xl:block" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">{guidance.eyebrow} help</p>
          <h2 className="mt-1.5 text-base font-medium leading-6">{guidance.title}</h2>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-subtle">{guidance.meta}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{guidance.body}</p>
      <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2.5">
        <p className="text-xs font-medium text-foreground">What to do on this screen</p>
        <p className="mt-1 text-xs leading-5 text-subtle">{blockedMessage || guidance.next}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link href="/ask" className="text-xs text-muted hover:text-foreground">Ask about this workspace</Link>
        <button onClick={() => setBlockedMessage("")} className={`text-xs text-subtle hover:text-muted ${blockedMessage ? "visible" : "invisible"}`}>Dismiss</button>
      </div>
    </div>
  );
}
