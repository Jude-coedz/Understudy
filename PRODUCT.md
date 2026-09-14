# Understudy V2 product truth

Understudy is an AI-powered work handoff system. It reconstructs what someone worked on from approved evidence, asks targeted questions about context the evidence cannot explain, identifies continuity risk, and prepares the next owner to continue the work.

## Primary user problem

Work is distributed across documents, code, project tools, AI conversations, and people's memory. Traditional handovers ask a departing or transitioning employee to remember everything at the end. Understudy starts from the evidence, reconstructs the work, and uses the employee's remaining time for the missing reasoning, exceptions, relationships, and decisions.

## Core object

The primary product object is a Transition, not a note or knowledge item. A transition connects a person, their role, evidence sources, reconstructed work, open knowledge gaps, interview responses, risks, successor questions, and a generated handoff.

## Product principles

- Evidence before inference.
- Every important derived claim should remain traceable to a source.
- AI-recovered context is useful evidence but is not automatically company truth.
- Ask people what artifacts cannot answer reliably.
- A handoff is not complete when a document exists; it is complete when ownership and context are ready for the next person.
- Understudy should complement systems like GitHub, Notion, Drive, and Linear rather than replace them.
- The product should explicitly say when information is missing or uncertain.

## Demo scope

The portfolio V2 demonstrates:
- transition creation and readiness
- document evidence
- public GitHub evidence
- AI-context recovery via structured prompt
- reconstructed work map
- continuity risks and knowledge gaps
- adaptive interview UI
- cited handover draft
- successor questions
- export-ready handover concept

Paid enterprise connectors, full OAuth, HRIS features, payroll, access deprovisioning, and generic project-management functionality are out of scope for this build.

## Audience

Primary: product and engineering teams in small-to-mid-sized software companies.
Secondary: operations and other knowledge-heavy roles.

## Voice

Precise, calm, evidence-oriented, operational. Avoid HR jargon, AI hype, and vague claims. Prefer concrete terms such as evidence, source, owner, gap, risk, decision, handoff, successor, and readiness.
