import { GithubEvidenceImport } from "@/components/github-evidence-import";
import { FocusedUtilityShell } from "@/components/focused-utility-shell";

export default function GithubIntegrationPage() {
  return (
    <FocusedUtilityShell backHref="/integrations" backLabel="Back to evidence connections">
      <GithubEvidenceImport />
    </FocusedUtilityShell>
  );
}
