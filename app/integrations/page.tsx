import Link from "next/link";
import { Shell } from "@/components/shell";
import { IconFile, IconGithub, IconPlug, IconSpark } from "@/components/icons";

const integrations = [
  {
    name: "Document evidence",
    description: "Upload DOCX, PDF, PPTX, XLSX, ODT, RTF, Markdown, CSV and other common work artifacts and reconstruct the handoff from their contents.",
    status: "Live",
    icon: IconFile,
  },
  {
    name: "Gemini analysis",
    description: "Reconstruct projects, ownership, decision context, continuity risks, role domains and interview gaps from the complete evidence set.",
    status: "Live",
    icon: IconSpark,
  },
  {
    name: "AI context import",
    description: "Recover work reasoning from ChatGPT, Claude, Gemini, or another assistant using a structured recovery prompt, then bring it back as lower-provenance evidence.",
    status: "Live",
    icon: IconSpark,
  },
  {
    name: "Google Drive",
    description: "Use Google Picker to choose the exact Docs, Sheets, or supported text files Understudy may read. The app requests per-file access rather than broad Drive access.",
    status: "Live · setup required",
    icon: IconPlug,
  },
  {
    name: "GitHub",
    description: "Import a public repository's README and recent pull requests, commits and issues into the current transition. Optionally focus the evidence on one contributor.",
    status: "Live",
    icon: IconGithub,
    href: "/integrations/github",
  },
  {
    name: "Account sync",
    description: "Persist authenticated workspaces through Supabase Auth, Postgres and owner-only Row Level Security instead of relying only on browser storage.",
    status: "Live · setup required",
    icon: IconPlug,
  },
  {
    name: "Notion / Linear / Jira",
    description: "These connectors are not wired yet. They should be added only when they add evidence that the current handoff cannot already recover reliably.",
    status: "Not connected",
    icon: IconPlug,
  },
] as const;

export default function IntegrationsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1060px] px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Integrations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Bring real work evidence into the handoff.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Understudy separates working evidence paths from integrations that still need authorization or implementation. A connector is not shown as live unless it can contribute real evidence.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {integrations.map((integration, index) => {
            const IntegrationIcon = integration.icon;
            const live = integration.status === "Live";
            const setup = integration.status.includes("setup");
            const body = (
              <div className={`grid gap-4 px-5 py-5 sm:grid-cols-[40px_minmax(0,1fr)_190px] sm:items-center ${index > 0 ? "border-t border-border" : ""} ${"href" in integration ? "hover:bg-card-hover" : ""}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background"><IntegrationIcon className="text-muted" /></div>
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">{integration.description}</p>
                </div>
                <div className="flex items-center gap-2 sm:justify-self-end">
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs ${live ? "border-ok/20 bg-ok/10 text-ok" : setup ? "border-warning/20 bg-warning/10 text-warning" : "border-border bg-background text-faint"}`}>{integration.status}</span>
                  {"href" in integration && <span className="text-sm text-subtle">→</span>}
                </div>
              </div>
            );
            return "href" in integration ? <Link key={integration.name} href={integration.href}>{body}</Link> : <div key={integration.name}>{body}</div>;
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 text-xs leading-5 text-subtle"><span className="font-medium text-foreground">Google Drive:</span> uses the narrow <span className="font-mono">drive.file</span> scope so the user explicitly chooses which files Understudy can read.</div>
          <div className="rounded-xl border border-border bg-card p-4 text-xs leading-5 text-subtle"><span className="font-medium text-foreground">GitHub:</span> Step 11 intentionally starts with public repositories. Private repository access will require a proper GitHub App/OAuth permission model, not personal access tokens pasted into Understudy.</div>
        </div>
      </div>
    </Shell>
  );
}
