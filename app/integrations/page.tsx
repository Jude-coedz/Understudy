import { Shell } from "@/components/shell";
import { IconFile, IconGithub, IconPlug, IconSpark } from "@/components/icons";

const integrations = [
  {
    name: "GitHub",
    description: "Analyse repositories, contribution history, pull requests, and code ownership evidence.",
    status: "Available in demo",
    icon: IconGithub,
  },
  {
    name: "Document upload",
    description: "Add PRDs, specifications, research, runbooks, Markdown, or exported documents as primary evidence.",
    status: "Available in demo",
    icon: IconFile,
  },
  {
    name: "AI context import",
    description: "Recover work reasoning from ChatGPT, Claude, Gemini, or another assistant using a structured handoff prompt.",
    status: "Available in demo",
    icon: IconSpark,
  },
  {
    name: "Google Drive",
    description: "Import selected folders and export the completed handoff back to the team's workspace.",
    status: "Planned",
    icon: IconPlug,
  },
  {
    name: "Notion",
    description: "Bring in approved pages and push the final handover into a Notion knowledge base.",
    status: "Planned",
    icon: IconPlug,
  },
  {
    name: "Linear / Jira",
    description: "Reconstruct project ownership, unresolved work, and decision context from issue history.",
    status: "Planned",
    icon: IconPlug,
  },
];

export default function IntegrationsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1060px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">Integrations</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-[-0.04em]">Bring the evidence to the handoff.</h1>
          <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">
            Understudy does not replace the tools where work happens. It reconstructs the transition from approved evidence, then keeps every claim traceable to its source.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {integrations.map((integration, index) => {
            const IntegrationIcon = integration.icon;
            const available = integration.status === "Available in demo";
            return (
              <div key={integration.name} className={`grid gap-4 px-4 py-4 sm:grid-cols-[36px_minmax(0,1fr)_130px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                  <IntegrationIcon className={integration.name === "AI context import" ? "text-[#aeb4ff]" : "text-muted"} />
                </div>
                <div>
                  <p className="text-[11.5px] font-medium">{integration.name}</p>
                  <p className="mt-1 max-w-2xl text-[9.5px] leading-4 text-subtle">{integration.description}</p>
                </div>
                <span className={`w-fit justify-self-start rounded-md border px-2 py-1 text-[9px] sm:justify-self-end ${available ? "border-ok/20 bg-ok/10 text-[#76c996]" : "border-border bg-background text-faint"}`}>
                  {integration.status}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-background p-4 text-[9.5px] leading-4 text-subtle">
          <span className="font-medium text-muted">Portfolio build scope:</span> the first version demonstrates public GitHub analysis, uploaded/simulated documents, and AI-context recovery without requiring paid enterprise connectors. Google Drive, Notion, Slack, and project-management OAuth can be layered on later without changing the core evidence model.
        </div>
      </div>
    </Shell>
  );
}
