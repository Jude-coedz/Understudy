import type { Transition } from "@/data/v2-demo";

export const AI_ASSISTANTS = ["ChatGPT", "Claude", "Gemini", "Other assistant"] as const;
export type AIContextAssistant = (typeof AI_ASSISTANTS)[number];

export const AI_CONTEXT_SCOPES = [
  {
    id: "history",
    label: "Conversation history",
    detail: "Recover context from prior work conversations the assistant can actually access.",
  },
  {
    id: "project-files",
    label: "Projects / uploaded files",
    detail: "Focus on project spaces, uploaded files, and attached work material available to the assistant.",
  },
  {
    id: "current-chat",
    label: "Current conversation",
    detail: "Use only the conversation you are currently in. Do not imply access to older history.",
  },
  {
    id: "mixed",
    label: "Everything available",
    detail: "Use any work conversations, project context, files, or memory the assistant can genuinely inspect.",
  },
] as const;

export type AIContextScope = (typeof AI_CONTEXT_SCOPES)[number]["id"];

type PromptContext = {
  transition: Pick<Transition, "person" | "role" | "department" | "targetDate" | "successor">;
  primarySourceTitles: string[];
  knownWorkAreas: string[];
  assistant: AIContextAssistant;
  scope: AIContextScope;
};

function assistantInstructions(assistant: AIContextAssistant) {
  if (assistant === "ChatGPT") {
    return "You are running this prompt in ChatGPT. Use only conversations, project context, uploaded files, connected context, or memory that this ChatGPT session can genuinely inspect. If older chats or projects are not accessible from this conversation, say so rather than implying that they were searched.";
  }
  if (assistant === "Claude") {
    return "You are running this prompt in Claude. Use only conversations, Project knowledge, uploaded files, or other context this Claude session can genuinely inspect. If earlier conversations or Project files are unavailable here, say so explicitly.";
  }
  if (assistant === "Gemini") {
    return "You are running this prompt in Gemini. Use only conversation history, Gems/workspace context, uploaded files, or connected context this Gemini session can genuinely inspect. Do not imply access to Drive, earlier chats, or account history unless it is actually available in this session.";
  }
  return "You are running this prompt in another AI assistant. Use only historical conversations, project context, files, or memory that this assistant can genuinely inspect. State clearly which kinds of historical context are unavailable.";
}

function scopeInstructions(scope: AIContextScope) {
  switch (scope) {
    case "history":
      return "CONTEXT BOUNDARY: Search only accessible prior work conversations or chat history. Do not use uploaded/project files unless they are directly part of those conversations. Prioritize decisions, rationale, commitments, repeated responsibilities, and follow-ups that appeared in discussions.";
    case "project-files":
      return "CONTEXT BOUNDARY: Focus on accessible project spaces, uploaded files, attachments, or knowledge bases. Do not use unrelated chat history. Prioritize requirements, ownership, active work, decisions documented in files, dependencies, and unresolved work.";
    case "current-chat":
      return "CONTEXT BOUNDARY: Use only information actually present in this current conversation and files attached to it. Do not claim to search older conversations, account memory, projects, or external sources.";
    case "mixed":
    default:
      return "CONTEXT BOUNDARY: Use any accessible work conversations, project spaces, uploaded files, connected work context, or genuine assistant memory. Keep provenance for each meaningful claim so Understudy can distinguish where it came from.";
  }
}

export function buildAIContextRecoveryPrompt({
  transition,
  primarySourceTitles,
  knownWorkAreas,
  assistant,
  scope,
}: PromptContext) {
  const sourceHints = primarySourceTitles.length
    ? primarySourceTitles.map((title) => `- ${title}`).join("\n")
    : "- No primary source titles have been added yet.";
  const workHints = knownWorkAreas.length
    ? knownWorkAreas.map((title) => `- ${title}`).join("\n")
    : "- No work areas have been reconstructed yet.";

  return `You are helping me recover work knowledge for a structured handoff.\n\n${assistantInstructions(assistant)}\n\n${scopeInstructions(scope)}\n\nHANDOFF CONTEXT\nPerson handing over: ${transition.person}\nRole: ${transition.role}\nTeam / department: ${transition.department}\nSuccessor: ${transition.successor}\nTarget handoff date: ${transition.targetDate}\n\nRecover only work context that is actually available inside the boundary above. Do not use general knowledge about the role to fill gaps. Do not invent projects, people, dates, decisions, ownership, outcomes, or rationale. If the requested historical context is not accessible, say so explicitly and only use what is genuinely available.\n\nDo not include passwords, API keys, access tokens, personal/private non-work information, confidential HR sentiment, medical information, or unrelated personal conversations.\n\nExisting primary-source titles in Understudy (use only as search hints, not as facts):\n${sourceHints}\n\nKnown work-area names in Understudy (use only as search hints, not as facts):\n${workHints}\n\nRecover the most transfer-relevant context you can find, especially:\n1. Responsibilities I repeatedly owned or was expected to handle.\n2. Active or recently active projects, initiatives, deliverables, and commitments.\n3. Important decisions, why they were made, tradeoffs, and rejected approaches.\n4. Stakeholders, dependencies, escalation paths, and who needs to be involved.\n5. Recurring routines, operational processes, exceptions, edge cases, and workarounds.\n6. Risks, fragile processes, unresolved problems, and person-dependent knowledge.\n7. Open work, promises, deadlines, follow-ups, or decisions a successor would inherit.\n8. Lessons or context that may not be obvious from formal documentation.\n\nFor every meaningful item, include the best provenance pointer you can provide, such as a conversation title, file name, project name, approximate date, or other traceable reference. Mark uncertainty clearly. If two sources disagree, preserve both sides instead of choosing one.\n\nReturn concise Markdown using exactly these sections:\n\n# Recovered work context\n## Responsibilities\n## Active work and commitments\n## Decisions and rationale\n## Stakeholders and dependencies\n## Recurring processes and exceptions\n## Risks and fragile knowledge\n## Open work and follow-ups\n## Contradictions or uncertainty\n## Source pointers\n\nUnder each section, use bullets. End each bullet with one of:\n- Confidence: high\n- Confidence: medium\n- Confidence: low\n\nIf there is no supported content for a section, write: No supported context found.`;
}
