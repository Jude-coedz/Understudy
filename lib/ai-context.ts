import type { Transition } from "@/data/v2-demo";

export const AI_ASSISTANTS = ["ChatGPT", "Claude", "Gemini", "Other assistant"] as const;

export type AIContextAssistant = (typeof AI_ASSISTANTS)[number];

type PromptContext = {
  transition: Pick<Transition, "person" | "role" | "department" | "targetDate" | "successor">;
  primarySourceTitles: string[];
  knownWorkAreas: string[];
};

export function buildAIContextRecoveryPrompt({
  transition,
  primarySourceTitles,
  knownWorkAreas,
}: PromptContext) {
  const sourceHints = primarySourceTitles.length
    ? primarySourceTitles.map((title) => `- ${title}`).join("\n")
    : "- No primary source titles have been added yet.";
  const workHints = knownWorkAreas.length
    ? knownWorkAreas.map((title) => `- ${title}`).join("\n")
    : "- No work areas have been reconstructed yet.";

  return `You are helping me recover work knowledge for a structured handoff.

HANDOFF CONTEXT
Person handing over: ${transition.person}
Role: ${transition.role}
Team / department: ${transition.department}
Successor: ${transition.successor}
Target handoff date: ${transition.targetDate}

Your task is to recover only work context that is actually available to you from this account/session, accessible conversation history, uploaded files, connected project context, or memories you can genuinely inspect.

Do not use general knowledge about the role to fill gaps. Do not invent projects, people, dates, decisions, ownership, outcomes, or rationale. If you cannot access historical chats/files/memory beyond this conversation, say so explicitly and only use what is genuinely available.

Do not include passwords, API keys, access tokens, personal/private non-work information, confidential HR sentiment, medical information, or unrelated personal conversations.

Existing primary-source titles in Understudy (use only as search hints, not as facts):
${sourceHints}

Known work-area names in Understudy (use only as search hints, not as facts):
${workHints}

Recover the most transfer-relevant context you can find, especially:
1. Responsibilities I repeatedly owned or was expected to handle.
2. Active or recently active projects, initiatives, deliverables, and commitments.
3. Important decisions, why they were made, tradeoffs, and rejected approaches.
4. Stakeholders, dependencies, escalation paths, and who needs to be involved.
5. Recurring routines, operational processes, exceptions, edge cases, and workarounds.
6. Risks, fragile processes, unresolved problems, and person-dependent knowledge.
7. Open work, promises, deadlines, follow-ups, or decisions a successor would inherit.
8. Lessons or context that may not be obvious from formal documentation.

For every meaningful item, include the best provenance pointer you can provide, such as a conversation title, file name, project name, approximate date, or other traceable reference. Mark uncertainty clearly. If two sources disagree, preserve both sides instead of choosing one.

Return concise Markdown using exactly these sections:

# Recovered work context
## Responsibilities
## Active work and commitments
## Decisions and rationale
## Stakeholders and dependencies
## Recurring processes and exceptions
## Risks and fragile knowledge
## Open work and follow-ups
## Contradictions or uncertainty
## Source pointers

Under each section, use bullets. End each bullet with one of:
- Confidence: high
- Confidence: medium
- Confidence: low

If there is no supported content for a section, write: No supported context found.`;
}
