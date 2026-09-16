import type { WorkspaceAskContext, WorkspaceAskResponse } from "@/lib/workspace-ask";

function response(question: string, answer: string): WorkspaceAskResponse {
  return { question, answer, unknown: false, gap: null, citations: [], usedModel: false };
}

export function answerWorkspaceMetadata(question: string, context: WorkspaceAskContext): WorkspaceAskResponse | null {
  const q = question.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const evidenceSources = context.sources.filter((source) => source.kind !== "interview");
  const documents = evidenceSources.filter((source) => source.kind === "document");
  const person = context.transition.person;

  if (/how many\s+(documents?|docs?|files?)/.test(q)) {
    return response(question, `${person}'s handoff currently contains ${documents.length} uploaded document${documents.length === 1 ? "" : "s"}. There are ${evidenceSources.length} non-interview evidence source${evidenceSources.length === 1 ? "" : "s"} in total when connected sources such as GitHub or AI-recovered context are included.`);
  }

  if (/how many\s+(sources?|artifacts?|evidence)/.test(q)) {
    return response(question, `${person}'s handoff currently contains ${evidenceSources.length} evidence source${evidenceSources.length === 1 ? "" : "s"}.`);
  }

  if (/(what|which|list|show).*(documents?|docs?|files?|sources?|artifacts?).*(upload|submit|add|include)?/.test(q) || /(what|which).*(was|were) uploaded/.test(q)) {
    if (!evidenceSources.length) return response(question, `No evidence sources have been added to ${person}'s handoff yet.`);
    const names = evidenceSources.map((source, index) => `${index + 1}. ${source.title}${source.provider ? ` (${source.provider})` : ""}`).join("\n");
    return response(question, `${person}'s handoff currently includes ${evidenceSources.length} evidence source${evidenceSources.length === 1 ? "" : "s"}:\n${names}`);
  }

  if (/(who|whose).*(handing over|leaving|current owner)/.test(q)) {
    return response(question, `${context.transition.person} is the person handing over the ${context.transition.role} role.`);
  }

  if (/(who|whose).*(successor|next owner|taking over)/.test(q)) {
    return response(question, `${context.transition.successor} is the recorded next owner for this handoff.`);
  }

  if (/(what|which).*(role|job)/.test(q) && /(handoff|transition|person|joe|owner)/.test(q)) {
    return response(question, `This handoff is for the ${context.transition.role} role in ${context.transition.department}.`);
  }

  if (/(target|handoff).*(date|when)|when.*(handoff|transition)/.test(q)) {
    return response(question, `The target handoff date is ${context.transition.targetDate}.`);
  }

  if (/how many\s+(projects?|work items?)/.test(q)) {
    return response(question, `Understudy currently has ${context.transition.projects.length} reconstructed project or active-work item${context.transition.projects.length === 1 ? "" : "s"} in this handoff.`);
  }

  if (/how many\s+(gaps?|questions?|follow-?ups?)/.test(q)) {
    return response(question, `This handoff currently has ${context.transition.gaps.length} recorded open gap${context.transition.gaps.length === 1 ? "" : "s"} or follow-up question${context.transition.gaps.length === 1 ? "" : "s"}.`);
  }

  return null;
}
