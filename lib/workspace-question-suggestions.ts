import type { PersonalWorkspace } from "@/lib/personal-workspace";

function addUnique(target: string[], question: string) {
  const normalized = question.trim().toLowerCase();
  if (!normalized || target.some((item) => item.trim().toLowerCase() === normalized)) return;
  target.push(question.trim());
}

export function workspaceQuestionSuggestions(workspace: PersonalWorkspace, limit = 6) {
  const suggestions: string[] = [];
  const { transition, roleEvidence } = workspace;
  const evidenceSources = transition.sources.filter((source) => source.kind !== "interview");

  addUnique(suggestions, `How many evidence sources are in ${transition.person}'s handoff, and what are they?`);
  addUnique(suggestions, `What are the most important things ${transition.successor} needs to know before taking over?`);

  if (transition.gaps.length) {
    addUnique(suggestions, "What is still unresolved before this handoff is complete?");
  } else if (transition.projects.length) {
    addUnique(suggestions, "What active work needs attention next, and who owns it?");
  }

  if (evidenceSources.length === 1) {
    const source = evidenceSources[0];
    addUnique(suggestions, `What does ${source.title} tell us about the work being handed over?`);
  } else if (evidenceSources.length > 1) {
    addUnique(suggestions, "Which files support the main responsibilities in this handoff?");
  }

  if (roleEvidence?.contradictions.length) {
    addUnique(suggestions, "Do any of the sources disagree with each other? Explain the disagreement in plain language.");
  }

  const thinDomain = roleEvidence?.domains.find((domain) => domain.status !== "Covered");
  if (thinDomain) {
    addUnique(suggestions, `What is still unclear about ${thinDomain.name}, and which files should I review?`);
  }

  const risk = transition.risks[0];
  if (risk) {
    addUnique(suggestions, `What should ${transition.successor} know about the risk “${risk.title}”?`);
  }

  const project = transition.projects[0];
  if (project) {
    addUnique(suggestions, `What is the current state of ${project.name}, what happens next, and who owns it?`);
  }

  return suggestions.slice(0, limit);
}
