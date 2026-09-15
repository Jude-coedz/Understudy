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

  if (evidenceSources.length === 1) {
    const source = evidenceSources[0];
    addUnique(suggestions, `What does ${source.title} establish about the work being handed over?`);
    if (transition.projects[0]) {
      addUnique(suggestions, `What does ${source.title} say about ${transition.projects[0].name}, including current state and ownership?`);
    }
    if (transition.gaps[0]) {
      addUnique(suggestions, `Does ${source.title} actually answer: ${transition.gaps[0].question}`);
    }
  }

  const thinDomains = roleEvidence?.domains.filter((domain) => domain.status !== "Covered") ?? [];
  const coveredDomains = roleEvidence?.domains.filter((domain) => domain.status === "Covered") ?? [];

  for (const domain of [...thinDomains, ...coveredDomains].slice(0, 3)) {
    addUnique(
      suggestions,
      `Across the evidence, what is actually supported about ${domain.name}, and which sources support it?`,
    );
  }

  if (roleEvidence?.contradictions.length) {
    const contradiction = roleEvidence.contradictions[0];
    addUnique(suggestions, `Which sources disagree about “${contradiction.claim}”, and what does each one say?`);
  } else if (evidenceSources.length >= 5) {
    addUnique(suggestions, `Across these ${evidenceSources.length} sources, where do ownership or current-state claims disagree?`);
  }

  for (const gap of transition.gaps.slice(0, 2)) {
    addUnique(suggestions, `What evidence exists for this open question: ${gap.question}`);
  }

  for (const risk of transition.risks.slice(0, 2)) {
    addUnique(suggestions, `What evidence supports the risk “${risk.title}”, and what should the successor know?`);
  }

  for (const project of transition.projects.slice(0, 2)) {
    addUnique(suggestions, `What is the latest evidence-backed state of ${project.name}, including ownership and unresolved work?`);
  }

  if (evidenceSources.length > 1) {
    addUnique(suggestions, `What responsibilities are corroborated by more than one of the ${evidenceSources.length} sources?`);
  }

  if (!suggestions.length && evidenceSources[0]) {
    addUnique(suggestions, `Summarize only what ${evidenceSources[0].title} proves about this handoff.`);
  }

  return suggestions.slice(0, limit);
}
