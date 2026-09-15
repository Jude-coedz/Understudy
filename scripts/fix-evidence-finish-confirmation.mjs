import fs from "node:fs";

const path = "components/evidence-workspace.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not locate ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  '  const [message, setMessage] = useState("");\n  const [googleToken, setGoogleToken] = useState("");\n  const fileInput = useRef<HTMLInputElement>(null);',
  '  const [message, setMessage] = useState("");\n  const [googleToken, setGoogleToken] = useState("");\n  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);\n  const [collectionSuccess, setCollectionSuccess] = useState<{ sourceCount: number; domainCount: number; usedModel: boolean } | null>(null);\n  const fileInput = useRef<HTMLInputElement>(null);',
  "finish confirmation state",
);

replaceOnce(
  '    if (!evidenceComplete) {\n      setStage("sources");\n      void finishEvidenceCollection();\n      return;\n    }',
  '    if (!evidenceComplete) {\n      setStage("sources");\n      requestFinishEvidenceCollection();\n      return;\n    }',
  "checkpoint evidence completion action",
);

const checkpointLabelEnd = `  const checkpointActionLabel = !evidenceSources.length\n    ? "Add evidence"\n    : !evidenceComplete\n      ? synthesisPhase >= 0 ? "Synthesizing evidence…" : "Finish evidence collection"\n      : unreviewed.length\n        ? "Review reconstruction"\n        : criticalGaps.length\n          ? "Open interview"\n          : activeInterviewGaps.length && !interviewSources.length\n            ? "Review interview questions"\n            : "Open handoff";\n`;

replaceOnce(
  checkpointLabelEnd,
  `${checkpointLabelEnd}\n  function requestFinishEvidenceCollection() {\n    if (!evidenceSources.length) {\n      setMessage("Add at least one real source before finishing evidence collection.");\n      return;\n    }\n    if (synthesisPhase >= 0) return;\n    setMessage("");\n    setFinishConfirmationOpen(true);\n  }\n`,
  "checkpoint label block",
);

replaceOnce(
  '      const next = mergeEvidenceResult(workspace, payload.result, input.text);\n      persist(next);',
  '      const next = mergeEvidenceResult(workspace, payload.result, input.text);\n      setCollectionSuccess(null);\n      persist(next);',
  "analysis success reset",
);

replaceOnce(
  '    persist({\n      ...workspace,\n      updatedAt: now,\n      transition,\n      sourceBodies,',
  '    setCollectionSuccess(null);\n    persist({\n      ...workspace,\n      updatedAt: now,\n      transition,\n      sourceBodies,',
  "removal success reset",
);

replaceOnce(
  '  async function finishEvidenceCollection() {\n    if (!workspace || !evidenceSources.length || synthesisPhase >= 0) {',
  '  async function finishEvidenceCollection() {\n    setFinishConfirmationOpen(false);\n    setCollectionSuccess(null);\n    if (!workspace || !evidenceSources.length || synthesisPhase >= 0) {',
  "finish evidence function start",
);

replaceOnce(
  '      persist(next);\n      setStage("map");\n      setMessage(',
  '      persist(next);\n      setCollectionSuccess({\n        sourceCount: synthesisSources.length,\n        domainCount: result.evidenceModel.domains.length,\n        usedModel: Boolean(payload.usedModel),\n      });\n      setStage("map");\n      setMessage(',
  "finish evidence success feedback",
);

replaceOnce(
  '  function reopenEvidenceCollection() {\n    if (!workspace) return;\n    persist({',
  '  function reopenEvidenceCollection() {\n    if (!workspace) return;\n    setCollectionSuccess(null);\n    persist({',
  "reopen evidence success reset",
);

replaceOnce(
  '<button onClick={() => void finishEvidenceCollection()} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">That&apos;s all I have</button>',
  '<button onClick={requestFinishEvidenceCollection} className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">That&apos;s all I have</button>',
  "that is all button",
);

const returnStart = `  return (\n    <div className="mx-auto max-w-[1320px] px-5 py-7 lg:px-8 lg:py-9">\n`;
const modal = `  return (\n    <div className="mx-auto max-w-[1320px] px-5 py-7 lg:px-8 lg:py-9">\n      {finishConfirmationOpen && (\n        <div\n          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"\n          onMouseDown={() => setFinishConfirmationOpen(false)}\n        >\n          <div\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="finish-evidence-title"\n            onMouseDown={(event) => event.stopPropagation()}\n            className="w-full max-w-lg rounded-2xl border border-border-strong bg-card p-6 shadow-2xl"\n          >\n            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"><IconSpark /></div>\n            <h2 id="finish-evidence-title" className="mt-4 text-xl font-semibold tracking-tight">Finish evidence collection?</h2>\n            <p className="mt-2 text-sm leading-6 text-muted">Understudy will synthesize the {evidenceSources.length} source{evidenceSources.length === 1 ? "" : "s"} you have added as the current evidence set for this handoff.</p>\n            <div className="mt-4 rounded-xl border border-border bg-background p-4">\n              <p className="text-sm font-medium">This does not mean the role is 100% documented.</p>\n              <p className="mt-1 text-xs leading-5 text-subtle">It means you are ready for Understudy to reconstruct the role from what is currently available. You can add more evidence later, which will reopen collection and rebuild the synthesis.</p>\n            </div>\n            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">\n              <button onClick={() => setFinishConfirmationOpen(false)} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm text-muted hover:bg-card-hover">Keep adding</button>\n              <button onClick={() => void finishEvidenceCollection()} className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background">Finish &amp; synthesize</button>\n            </div>\n          </div>\n        </div>\n      )}\n`;
replaceOnce(returnStart, modal, "workspace return start");

const mapStart = `          {stage === "map" && (\n            <section>\n              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-medium">Reconstruction</h2><p className="mt-1 text-sm leading-6 text-subtle">The map below is synthesized across the whole evidence set. “Covered” means corroborated by the supplied evidence, not proof that no work is missing.</p></div>{evidenceComplete && <button onClick={reopenEvidenceCollection} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Add more evidence</button>}</div>\n`;
const mapWithSuccess = `          {stage === "map" && (\n            <section>\n              {collectionSuccess && evidenceComplete && (\n                <div role="status" aria-live="polite" className="mb-4 rounded-xl border border-ok/25 bg-ok/5 p-4">\n                  <div className="flex items-start gap-3">\n                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok"><IconCheck className="h-4 w-4" /></div>\n                    <div className="min-w-0 flex-1">\n                      <p className="text-sm font-medium text-foreground">Evidence collection finished</p>\n                      <p className="mt-1 text-sm leading-6 text-muted">{collectionSuccess.sourceCount} source{collectionSuccess.sourceCount === 1 ? "" : "s"} {collectionSuccess.usedModel ? "were synthesized" : "were indexed"} into {collectionSuccess.domainCount} observed work domain{collectionSuccess.domainCount === 1 ? "" : "s"}. This is the current evidence snapshot, not a claim that the role is 100% complete.</p>\n                    </div>\n                    <button onClick={() => setCollectionSuccess(null)} className="shrink-0 rounded-md px-2 py-1 text-xs text-subtle hover:bg-ok/10">Dismiss</button>\n                  </div>\n                </div>\n              )}\n              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-medium">Reconstruction</h2><p className="mt-1 text-sm leading-6 text-subtle">The map below is synthesized across the whole evidence set. “Covered” means corroborated by the supplied evidence, not proof that no work is missing.</p></div>{evidenceComplete && <button onClick={reopenEvidenceCollection} className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:bg-card-hover">Add more evidence</button>}</div>\n`;
replaceOnce(mapStart, mapWithSuccess, "reconstruction section start");

fs.writeFileSync(path, source);
