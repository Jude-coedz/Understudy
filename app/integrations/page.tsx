import { Shell } from "@/components/shell";
import { IconFile, IconGithub, IconPlug, IconSpark } from "@/components/icons";

const integrations = [
  {
    name: "Document evidence",
    description: "Paste or upload TXT, Markdown, JSON, and CSV work artifacts and reconstruct the handoff from their contents.",
    status: "Live",
    icon: IconFile,
  },
  {
    name: "Gemini analysis",
    description: "Reconstruct projects, ownership, decision context, continuity risks, and interview gaps from each evidence source.",
    status: "Live",
    icon: IconSpark,
  },
  {
    name: "AI context import",
    description: "Recover work reasoning from ChatGPT, Claude, Gemini, or another assistant using a structured recovery prompt, then bring it back as evidence.",
    status: "Live",
    icon: IconSpark,
  },
  {
    name: "Google Drive",
    description: "Connect a Google account and use Google Picker to choose the exact Docs, Sheets, or text files Understudy may read. The app requests per-file access rather than broad Drive access.",
    status: "Code ready · setup required",
    icon: IconPlug,
  },
  {
    name: "GitHub",
    description: "Public-repository analysis is represented in the demo but is not connected to the personal workspace yet.",
    status: "Demo only",
    icon: IconGithub,
  },
  {
    name: "Notion / Linear / Jira",
    description: "These connectors are not wired yet. They should be added only after the evidence and authorization model is stable.",
    status: "Not connected",
    icon: IconPlug,
  },
];

export default function IntegrationsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1060px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">Integrations</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-[-0.04em]">Bring real work evidence into the handoff.</h1>
          <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">
            Understudy should never imply a connector is live when it is not. This screen separates working evidence paths from integrations that still require setup or implementation.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {integrations.map((integration, index) => {
            const IntegrationIcon = integration.icon;
            const live = integration.status === "Live";
            const setup = integration.status.includes("setup");
            return (
              <div key={integration.name} className={`grid gap-4 px-4 py-4 sm:grid-cols-[36px_minmax(0,1fr)_170px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                  <IntegrationIcon className={integration.name.includes("Gemini") || integration.name.includes("AI context") ? "text-[#aeb4ff]" : "text-muted"} />
                </div>
                <div>
                  <p className="text-[11.5px] font-medium">{integration.name}</p>
                  <p className="mt-1 max-w-2xl text-[9.5px] leading-4 text-subtle">{integration.description}</p>
                </div>
                <span className={`w-fit justify-self-start rounded-md border px-2 py-1 text-[9px] sm:justify-self-end ${live ? "border-ok/20 bg-ok/10 text-[#76c996]" : setup ? "border-warning/20 bg-warning/10 text-[#daba72]" : "border-border bg-background text-faint"}`}>
                  {integration.status}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4 text-[9.5px] leading-4 text-subtle">
            <span className="font-medium text-muted">Google Drive setup:</span> enable Google Drive API + Google Picker API, create a Web OAuth client, then add the public client ID and browser API key to Cloudflare. Understudy uses the <span className="font-mono text-muted">drive.file</span> scope so users explicitly pick what the app can read.
          </div>
          <div className="rounded-xl border border-border bg-background p-4 text-[9.5px] leading-4 text-subtle">
            <span className="font-medium text-muted">Account isolation today:</span> personal trial workspaces are browser/account-namespaced, so visitors do not share the demo state. Server-side account persistence is intentionally separated as the next infrastructure step rather than faked in the UI.
          </div>
        </div>
      </div>
    </Shell>
  );
}
