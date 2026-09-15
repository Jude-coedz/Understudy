"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWorkspace, type PersonalWorkspace } from "@/lib/personal-workspace";
import { IconCheck, IconChevronRight, IconFile } from "./icons";

function openReconstruction() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const reconstruction = buttons.find((button) => button.textContent?.includes("2. Reconstruction"));
  reconstruction?.click();
  window.setTimeout(() => {
    const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find((item) => item.textContent?.trim() === "Reconstruction");
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

export function WorkspaceEvidenceStatus() {
  const [workspace, setWorkspace] = useState<PersonalWorkspace | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    function refresh() {
      setWorkspace(getCurrentWorkspace());
    }
    refresh();
    window.addEventListener("understudy:workspace-saved", refresh);
    return () => window.removeEventListener("understudy:workspace-saved", refresh);
  }, []);

  const evidenceSources = useMemo(
    () => workspace?.transition.sources.filter((source) => source.kind !== "interview") ?? [],
    [workspace],
  );
  const unreviewed = useMemo(
    () => evidenceSources.filter((source) => !workspace?.reviewedSourceIds.includes(source.id)),
    [evidenceSources, workspace],
  );
  const roleEvidence = workspace?.roleEvidence;
  const covered = roleEvidence?.domains.filter((domain) => domain.status === "Covered").length ?? 0;
  const partial = roleEvidence?.domains.filter((domain) => domain.status === "Partial").length ?? 0;
  const thin = roleEvidence?.domains.filter((domain) => domain.status === "Thin").length ?? 0;

  if (!workspace || !evidenceSources.length) return null;

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-5 lg:px-8">
      <AnimatePresence initial={false}>
        {unreviewed.length > 0 && (
          <motion.div
            key="review-needed"
            layout
            initial={reducedMotion ? false : { opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 34 }}
            className="overflow-hidden rounded-xl border border-warning/25 bg-warning/5 p-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/20 bg-card"><IconFile className="h-4 w-4 text-warning" /></div>
                <div>
                  <p className="text-sm font-medium">{unreviewed.length} source{unreviewed.length === 1 ? " needs" : "s need"} review</p>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">
                    “Needs review” does not mean the file failed. It means Understudy has interpreted the source, but a person has not yet confirmed that the interpretation is reasonable. Review the reconstruction, then verify each source before the interview unlocks.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unreviewed.slice(0, 4).map((source) => <span key={source.id} className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-subtle">{source.title}</span>)}
                    {unreviewed.length > 4 && <span className="px-1 py-1 text-[11px] text-faint">+{unreviewed.length - 4} more</span>}
                  </div>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={openReconstruction}
                whileHover={reducedMotion ? undefined : { y: -1 }}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background"
              >
                Review source interpretations <IconChevronRight />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className={`${unreviewed.length ? "mt-3" : ""} rounded-xl border border-border bg-card`}>
        <button type="button" onClick={() => setCoverageOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
          <div>
            <p className="text-sm font-medium">How Understudy reads evidence coverage</p>
            <p className="mt-1 text-xs leading-5 text-subtle">
              Coverage describes support for observed work domains. It is not a percentage of the employee&apos;s entire role and it cannot prove that no project or responsibility was forgotten.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {roleEvidence ? <span className="hidden text-xs text-subtle sm:inline">{covered} covered · {partial} partial · {thin} thin</span> : <span className="hidden text-xs text-subtle sm:inline">Finish evidence collection to build the map</span>}
            <motion.span
              className="text-subtle"
              animate={{ rotate: coverageOpen ? 90 : 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 32 }}
            >
              <IconChevronRight />
            </motion.span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {coverageOpen && (
            <motion.div
              key="coverage-details"
              initial={reducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="px-4 pb-4 pt-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <motion.div layout className="rounded-lg border border-ok/20 bg-ok/5 p-3">
                    <div className="flex items-center gap-2"><IconCheck className="h-4 w-4 text-ok" /><p className="text-xs font-medium">Covered</p></div>
                    <p className="mt-1 text-xs leading-5 text-subtle">The observed domain has corroborating primary evidence or multiple supporting primary sources.</p>
                  </motion.div>
                  <motion.div layout className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <p className="text-xs font-medium">Partial</p>
                    <p className="mt-1 text-xs leading-5 text-subtle">There is meaningful evidence for the domain, but important details, corroboration, ownership, or current state are still incomplete.</p>
                  </motion.div>
                  <motion.div layout className="rounded-lg border border-danger/20 bg-danger/5 p-3">
                    <p className="text-xs font-medium">Thin</p>
                    <p className="mt-1 text-xs leading-5 text-subtle">The domain currently rests on weak, single-source, AI-recovered, or otherwise insufficiently corroborated evidence.</p>
                  </motion.div>
                </div>

                {roleEvidence && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium">What Understudy can say</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">It can identify the work domains present in the supplied evidence, show which sources support them, flag contradictions, and show where support is weak.</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium">What it cannot say</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">It cannot know with certainty that an eight-month role is “100% complete.” Likely missing areas are hypotheses used to guide review, not proof that omitted work existed.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
