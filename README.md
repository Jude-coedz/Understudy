# Understudy

**Understudy reconstructs an employee's work from existing evidence, finds what only they know, and turns it into a successor-verified handoff.**

When someone changes roles or leaves a company, the next person usually inherits documents, folders, chat history, and a short handover note. What disappears is the operating context: why decisions were made, recurring exceptions, ownership boundaries, unfinished work, and the things the outgoing person simply knew.

Understudy is a proof of concept for preserving that context without asking someone to document their job from scratch.

## How it works

```text
Create a handoff
      ↓
Collect existing evidence
      ├── uploaded documents
      ├── Google Drive files
      ├── GitHub / work artifacts
      ├── recovered AI context
      └── employee-provided context (typed or dictated)
      ↓
Understudy reconstructs the role
      ↓
Employee reviews the interpretation
      ↓
Understudy finds missing context
      ↓
Adaptive gap interview
      ↓
Successor receives the handoff
      ↓
Successor asks cited questions and verifies continuity
```

The product follows one rule throughout:

> **Evidence before inference.**

Primary sources, AI-recovered material, and self-reported context keep their provenance visible rather than silently becoming the same kind of truth.

## What the POC demonstrates

- Multi-source evidence collection
- File text extraction
- Google Drive file selection
- AI-context recovery from tools such as ChatGPT, Claude, and Gemini
- Employee-provided role context with typing and browser voice dictation
- Whole-role reconstruction across an evidence set
- Source provenance and confidence
- Missing-context and continuity-gap detection
- Adaptive handoff interview
- Source-specific clarification
- Evidence-grounded Ask Understudy
- Successor notes and follow-up questions
- Successor verification before a handoff is marked complete
- Reopening a handoff when the successor discovers a blocking gap
- Private local trial state and optional account sync
- Deterministic evidence fallback when model synthesis is unavailable

## Guided demo

The quickest way to understand Understudy is the fictional guided handoff:

```text
/demo
```

It walks through:

1. **Collect** — start with work that already exists and add employee context.
2. **Understand** — reconstruct responsibilities, active work, decisions, risks, and ownership.
3. **Fill the gaps** — ask only what the evidence cannot explain.
4. **Hand over** — give the successor usable context with source-backed answers.
5. **Verify** — finish only when the successor confirms they can continue the work.

## AI context recovery

Modern work reasoning often lives inside AI assistants rather than formal documents.

Understudy can generate a structured recovery prompt for a user to run in an assistant they used for work. The returned material is imported as **AI-recovered evidence**, clearly separated from primary documents and self-reported employee context.

## Employee-provided context

Not everything a person did during a role will exist in a file.

During evidence collection, the employee can type or dictate how the role actually worked: recurring responsibilities, unwritten exceptions, stakeholder relationships, decision rationale, and practical steps a successor would otherwise have to rediscover.

This material is stored as **self-reported context** and is compared with the rest of the evidence rather than treated as primary evidence.

## AI provider

The hosted synthesis adapter uses the Gemini Developer API through a server-side route.

Default model:

```text
gemini-3.1-flash-lite
```

If the model is unavailable, supported flows fall back to deterministic evidence retrieval rather than inventing an answer.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Motion
- Zustand
- Gemini Developer API
- vinext
- Cloudflare Workers

## Run locally

Requirements:

- Node.js 22+
- Gemini API key optional for deterministic demo flows

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://127.0.0.1:43127
```

For the Cloudflare-compatible development path:

```bash
npm run dev:cloudflare
```

## Cloudflare deployment

The app and server routes run on Cloudflare Workers. Model credentials stay server-side as Worker secrets.

Recommended Git-connected settings:

```text
Production branch: main
Node version: 22+
Build command: npm run build:cloudflare
Deploy command: npx wrangler deploy
```

Required Worker secret:

```text
GEMINI_API_KEY
```

## Security

Use fictional or sanitized company material when testing the public POC. API keys are not intended to be exposed to the browser or committed to the repository.

## License

MIT
