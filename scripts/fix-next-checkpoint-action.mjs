import fs from "node:fs";

const path = "components/evidence-workspace.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not locate ${label}`);
  source = source.replace(search, replacement);
}

const requestStageEnd = `  function requestStage(next: Stage) {\n    if (stageAccess[next]) {\n      setStage(next);\n      setMessage(\"\");\n      return;\n    }\n    if (next === \"map\") {\n      setMessage(\"Add at least one real source before reviewing a reconstruction.\");\n    } else if (next === \"interview\") {\n      setMessage(\n        !evidenceComplete\n          ? \"Finish evidence collection so Understudy can synthesize the full set into a role-level evidence map first.\"\n          : \`Review the reconstruction first. \${unreviewed.length} source\${unreviewed.length === 1 ? \"\" : \"s\"} still need verification.\`,\n      );\n    } else {\n      setMessage(\n        criticalGaps.length\n          ? \`The handoff is not ready yet. \${criticalGaps.length} critical item\${criticalGaps.length === 1 ? \" still needs\" : \"s still need\"} a real answer or follow-up.\`\n          : \"Complete evidence review before opening the handoff.\",\n      );\n    }\n  }\n`;

const withCheckpointHandler = `${requestStageEnd}\n  function handleNextCheckpoint() {\n    if (!evidenceSources.length) {\n      setStage(\"sources\");\n      setShowAdd(true);\n      setMessage(\"Add the first real artifact for this role, then Understudy can begin reconstructing the work.\");\n      return;\n    }\n\n    if (!evidenceComplete) {\n      setStage(\"sources\");\n      void finishEvidenceCollection();\n      return;\n    }\n\n    if (unreviewed.length) {\n      requestStage(\"map\");\n      return;\n    }\n\n    if (criticalGaps.length || (activeInterviewGaps.length && !interviewSources.length)) {\n      requestStage(\"interview\");\n      return;\n    }\n\n    requestStage(\"handoff\");\n  }\n\n  const checkpointActionLabel = !evidenceSources.length\n    ? \"Add evidence\"\n    : !evidenceComplete\n      ? synthesisPhase >= 0 ? \"Synthesizing evidence…\" : \"Finish evidence collection\"\n      : unreviewed.length\n        ? \"Review reconstruction\"\n        : criticalGaps.length\n          ? \"Open interview\"\n          : activeInterviewGaps.length && !interviewSources.length\n            ? \"Review interview questions\"\n            : \"Open handoff\";\n`;

replaceOnce(requestStageEnd, withCheckpointHandler, "requestStage block");

replaceOnce(
  '<button onClick={() => requestStage(recommended)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background">Go to next step <IconChevronRight /></button>',
  '<button disabled={synthesisPhase >= 0} onClick={handleNextCheckpoint} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:cursor-wait disabled:opacity-50">{checkpointActionLabel} <IconChevronRight /></button>',
  "next checkpoint button",
);

fs.writeFileSync(path, source);
