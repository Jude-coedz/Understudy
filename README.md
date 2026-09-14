# Understudy

**Understudy is an AI-powered work handoff system that reconstructs what someone worked on, finds missing context, and helps transfer ownership before that knowledge disappears.**

Understudy is being rebuilt around a simple idea: when work changes hands, the successor should inherit more than a folder of documents. They should inherit the projects, decisions, reasoning, risks, open work, and source evidence needed to continue.

## V2 product flow

```text
Create transition
      ↓
Collect evidence
      ├── documents
      ├── GitHub
      ├── AI conversation recovery
      └── employee input
      ↓
AI reconstructs work
      ↓
Employee confirms / corrects
      ↓
Understudy detects gaps
      ↓
Adaptive handoff interview
      ↓
Verified handoff
      ↓
Successor questions + cited answers
```

The V2 UI is built around **Transitions** rather than a generic knowledge base. Supporting capabilities include Sources, Work Map, Interview, Handover, Questions, and Continuity risk.

## AI context recovery

A meaningful amount of modern work reasoning lives in tools such as ChatGPT, Claude, and Gemini rather than formal documents.

Understudy can generate a structured recovery prompt for an employee to run inside the AI assistant they used for work. The returned context can then be imported as **AI-recovered evidence** and reviewed alongside primary documents and self-reported interview answers.

AI-recovered evidence is never treated as unquestionable truth. Understudy keeps source provenance and confidence visible.

## AI provider

The hosted AI adapter uses the Gemini Developer API through a server-side route.

Default model:

```text
gemini-3.1-flash-lite
```

If `GEMINI_API_KEY` is missing or the model call fails, the existing deterministic fallback logic remains available for supported demo flows.

## Running locally

Requirements:

- Node.js 20+
- A Gemini API key is optional for deterministic demo flows

Install and run the normal Next.js development server:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://127.0.0.1:43127
```

To run using the Cloudflare Workers-compatible vinext development path:

```bash
npm run dev:cloudflare
```

## Cloudflare deployment

Understudy follows the same deployment principle as Forge: the application and its server routes run on **Cloudflare Workers**, while the model API key stays server-side as an encrypted Worker secret.

The repository includes:

- `vite.config.ts` — vinext + Cloudflare Vite configuration
- `wrangler.jsonc` — Worker configuration
- `npm run build:cloudflare` — production Workers build
- `npm run deploy` — build and deploy with Wrangler

### Required Cloudflare secret

Add this in Cloudflare rather than committing it to GitHub:

```text
GEMINI_API_KEY
```

`GEMINI_MODEL` is non-sensitive and defaults to `gemini-3.1-flash-lite` in `wrangler.jsonc`.

For local Workers development, place secrets in `.dev.vars` or `.env` and do not commit those files.

### Git-connected deployment

Connect this GitHub repository to a Cloudflare Worker and use `main` as the production branch. Cloudflare Workers Builds can then rebuild and deploy whenever new commits land on `main`.

Build command:

```bash
npm run build:cloudflare
```

Deploy command:

```bash
npx wrangler deploy
```

## Current stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand
- Gemini Developer API
- vinext
- Cloudflare Workers

## Current V2 scope

The first V2 slice establishes the product shell and transition workflow. The next implementation slice is:

1. real transition domain model
2. document ingestion
3. Gemini structured extraction
4. gap detection
5. public GitHub analysis
6. adaptive interview feedback loop
7. grounded Ask-the-Handoff
8. handoff export

## Security note

API keys are never intended to be exposed to the browser or committed to the repository. For this free portfolio build, use fictional or sanitized company material when testing third-party AI APIs.

## License

MIT
