import fs from "node:fs";

const path = "components/guided-workspace.tsx";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!text.includes(from)) throw new Error(`Patch target missing: ${label}`);
  text = text.replace(from, to);
}

replaceOnce(
  '  const [contextBusy, setContextBusy] = useState(false);\n  const uploadRef = useRef<HTMLInputElement>(null);',
  '  const [contextBusy, setContextBusy] = useState(false);\n  const [sourceQuery, setSourceQuery] = useState("");\n  const uploadRef = useRef<HTMLInputElement>(null);',
  "source search state",
);

replaceOnce(
  '  const previewSource = transition?.sources.find((source) => source.id === previewSourceId) ?? null;\n',
  '  const previewSource = transition?.sources.find((source) => source.id === previewSourceId) ?? null;\n  const filteredRoleSources = useMemo(() => {\n    const query = sourceQuery.trim().toLowerCase();\n    if (!query) return roleSources;\n    return roleSources.filter((source) => `${source.title} ${source.provider} ${evidenceLabel(source)}`.toLowerCase().includes(query));\n  }, [roleSources, sourceQuery]);\n',
  "filtered source list",
);

replaceOnce(
  'className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted">Add another source</button>',
  'className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background shadow-sm">+ Add evidence</button>',
  "add evidence button",
);

replaceOnce(
  'className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background"',
  'className="mt-4 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background"',
  "collect source list height",
);

replaceOnce(
  '<span className="text-xs text-subtle">{roleSources.length} sources</span></div></div><div className="divide-y divide-border">{roleSources.map((source) => {',
  '<span className="text-xs text-subtle">{roleSources.length} sources</span></div><div className="mt-4"><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search files or evidence sources…" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-faint focus:border-border-strong" /></div></div><div className="max-h-[560px] divide-y divide-border overflow-y-auto">{filteredRoleSources.map((source) => {',
  "searchable reconstruction sources",
);

replaceOnce(
  '})}</div></div>\n\n              <div className="mt-6 border-t border-border pt-5">',
  '})}{filteredRoleSources.length === 0 && <div className="p-6 text-center text-sm text-subtle">No evidence sources match “{sourceQuery}”.</div>}</div></div>\n\n              <div className="mt-6 border-t border-border pt-5">',
  "empty source search",
);

const oldFinal = '<div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/recover-ai" className="rounded-2xl border border-border bg-card p-5 hover:border-border-strong"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><p className="mt-3 text-sm font-medium">Remembered something from AI?</p><p className="mt-1 text-xs leading-5 text-subtle">Recover AI context. New evidence will reopen Collect and rebuild the handoff instead of silently changing a finished draft.</p></Link><Link href="/review" className="rounded-2xl border border-accent/30 bg-accent px-5 py-5 text-white shadow-sm"><p className="text-sm font-medium">Continue to successor review</p><p className="mt-1 text-xs leading-5 text-white/75">{transition.successor} verifies scope, active work, ownership, risks, and open questions.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">Start verification <IconChevronRight /></span></Link></div>\n                <div className="mt-5"><button onClick={() => go("interview")} className="text-sm font-medium text-subtle">← Back to gap review</button></div>';
const newFinal = '<div className="mt-6 grid gap-3 sm:grid-cols-2"><Link href="/ask" className="rounded-2xl border border-border bg-card p-5 hover:border-border-strong"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><IconSpark /></span><p className="mt-3 text-sm font-medium">Ask Understudy</p><p className="mt-1 text-xs leading-5 text-subtle">Ask about a decision, owner, dependency, source, or workspace fact before the successor verifies the handoff.</p></Link><Link href="/review" className="rounded-2xl border border-accent/30 bg-accent px-5 py-5 text-white shadow-sm"><p className="text-sm font-medium">Continue to successor review</p><p className="mt-1 text-xs leading-5 text-white/75">{transition.successor} verifies the handoff with one explicit final acceptance.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">Start verification <IconChevronRight /></span></Link></div><p className="mt-3 text-xs leading-5 text-subtle">Remembered missing evidence? <Link href="/recover-ai" className="font-medium text-accent">Recover AI context</Link> or go back to Collect. New evidence will reopen the reconstruction.</p>\n                <div className="mt-5"><button onClick={() => go("interview")} className="text-sm font-medium text-subtle">← Back to gap review</button></div>';
replaceOnce(oldFinal, newFinal, "final-stage actions");

fs.writeFileSync(path, text);
fs.rmSync("scripts/apply-guided-workspace-polish.mjs");
fs.rmSync(".github/workflows/apply-guided-workspace-polish.yml");
