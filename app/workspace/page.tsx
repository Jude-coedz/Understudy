import { EvidenceWorkspace } from "@/components/evidence-workspace";
import { Shell } from "@/components/shell";
import { WorkspaceContextualGuide } from "@/components/workspace-contextual-guide";
import { WorkspaceEvidenceStatus } from "@/components/workspace-evidence-status";

export default function WorkspacePage() {
  return (
    <Shell>
      <WorkspaceEvidenceStatus />
      <EvidenceWorkspace />
      <WorkspaceContextualGuide />
    </Shell>
  );
}
