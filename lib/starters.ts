import type { Person, Topic } from "./types";
import { TOPIC_LABELS } from "./types";
import { firstName } from "./seed";

export function starterQuestion(
  person: Person,
  topic: Topic | null,
): { question: string; askingBecause: string } {
  const who = firstName(person.name);
  if (!topic) {
    return {
      askingBecause:
        "No gap is pinned yet. Start with something they actually do this week, then keep the why.",
      question: `${who}, what is one thing a new person would get wrong in their first week here — and why does it go wrong?`,
    };
  }
  return {
    askingBecause: `Opening on ${TOPIC_LABELS[topic].toLowerCase()} because Coverage sent us here. Ask for the incident, not a policy line.`,
    question: `${who}, walk me through ${TOPIC_LABELS[topic].toLowerCase()} the way you actually do it. What happened the last time someone did it the other way?`,
  };
}
