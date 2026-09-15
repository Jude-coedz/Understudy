import { EvidenceWorkspace } from "@/components/evidence-workspace";
import { Shell } from "@/components/shell";
import { WorkspaceContextualGuide } from "@/components/workspace-contextual-guide";

export default function WorkspacePage() {
  return (
    <Shell>
      <EvidenceWorkspace />
      <WorkspaceContextualGuide />
    </Shell>
  );
}
