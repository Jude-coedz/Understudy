import fs from "node:fs";

const files = [
  {
    path: "components/onboarding-flow-polished.tsx",
    nextFunction: "connectAndPickDrive",
    replacement: `  async function readUpload(file?: File) {
    if (!file) return;
    setAnalysisError("");
    try {
      const text = await extractFileText(file);
      setSourceTitle(file.name);
      setSourceText(text);
      setSourceProvider("Uploaded document");
      setErrors((current) => ({ ...current, sourceTitle: undefined, sourceText: undefined }));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Understudy could not read this file.");
    }
  }

`,
  },
  {
    path: "components/evidence-workspace.tsx",
    nextFunction: "connectDrive",
    replacement: `  async function readUpload(file?: File) {
    if (!file) return;
    setMessage("");
    try {
      const text = await extractFileText(file);
      setSourceTitle(file.name);
      setSourceText(text);
      setSourceProvider("Uploaded document");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Understudy could not read this file.");
    }
  }

`,
  },
];

for (const config of files) {
  let source = fs.readFileSync(config.path, "utf8");

  if (!source.includes('from "@/lib/file-extraction"')) {
    const anchor = 'import type { ReconstructionResult } from "@/lib/v2-reconstruction";';
    source = source.replace(
      anchor,
      `${anchor}\nimport { extractFileText, SUPPORTED_UPLOAD_ACCEPT, SUPPORTED_UPLOAD_LABEL } from "@/lib/file-extraction";`,
    );
  }

  const functionPattern = new RegExp(
    `  async function readUpload\\(file\\?: File\\) \\{[\\s\\S]*?\\n  \\}\\n\\n  async function ${config.nextFunction}`,
  );
  if (!functionPattern.test(source)) {
    throw new Error(`Could not locate readUpload in ${config.path}`);
  }
  source = source.replace(functionPattern, `${config.replacement}  async function ${config.nextFunction}`);

  source = source
    .replace('["upload", "Upload file", "TXT / MD / JSON / CSV"]', '["upload", "Upload file", SUPPORTED_UPLOAD_LABEL]')
    .replace(/>TXT, Markdown, JSON, or CSV<\/p>/g, '>{SUPPORTED_UPLOAD_LABEL}</p>')
    .replace(/>Choose TXT, Markdown, JSON, or CSV<\/span>/g, '>Choose {SUPPORTED_UPLOAD_LABEL}</span>')
    .replace(/accept="\.txt,\.md,\.json,\.csv,text\/plain,text\/markdown,application\/json,text\/csv"/g, 'accept={SUPPORTED_UPLOAD_ACCEPT}')
    .replace(/accept="\.txt,\.md,\.json,\.csv"/g, 'accept={SUPPORTED_UPLOAD_ACCEPT}');

  fs.writeFileSync(config.path, source);
}
