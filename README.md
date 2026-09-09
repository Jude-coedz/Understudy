# Understudy

Capture operational knowledge in a small business *before people leave*. This is a working product demo, not a platform.

Demo world: **FastTrack Dispatch**, a Lagos logistics shop. Three people already interviewed. Twenty-one seeded records. One intentional dispute (Musa / urgent jobs).

The product is judged on three things:

1. **Keep the why.** File the speaker’s reasoning (Pidgin, incidents, names), not a tidy wiki line.
2. **Ask sparingly.** Questions come from gaps (missing topic, thin why, disagreement), not a survey.
3. **Brief, don’t search.** Natural-language questions return a briefing with provenance. Disagreements stay as both sides. Unknowns return a gap, not a guess.

On top of that: disputes, freshness/decay, coverage (who would break the shop this week), handover packs.

## Run it

Node.js 20+. Anthropic key optional — Capture, Ask, and handover still run via a local fallback.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## 15-minute walkthrough

1. **Knowledge (`/`)** — Twenty-one cards. Reasoning is always visible. Filter **Disputes**: KR-006 (Emeka) vs KR-021 (Bola) on Musa. Filter **Aging / stale** for routes and warnings that have decayed. **Reset demo** restores the seed. **New business** empties the store.

2. **Ask (`/ask`)** — Send: *Who shouldn’t we use for urgent jobs?* You must see **both** Emeka and Bola. Averaging or hiding Emeka is a product failure. Citation chips look like `KR-010 · Emeka · 2w ago`. Then ask something the shop never filed (a ferry in Apapa). You should get a **gap**, not a guess.

3. **Coverage (`/coverage`)** — People × topics. Empty / thin / dense. A **ring** is a sole holder (Emeka on routes, Tunde on generator). A **dot** is a dispute or stale cell. Click a cell → panel → Capture. Extraction eval badge should read **8/8**. **If X is out** builds a 1- or 2-week handover pack.

4. **Capture (`/capture`)** — Simulated interview. Read **Asking because**. Answer in the speaker’s voice. Edit the live extraction on the right before save. If it would dispute Musa, it **warns and files a second side** — it does not overwrite.

If Musa is missing after a pull, hit **Reset demo**. Older `localStorage` predates KR-021; store migrate v2 injects it when KR-006 exists without it.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Zustand persist `understudy-kb` v2. No auth, no database, no component library. MIT.

See [HANDOFF.md](HANDOFF.md) for the file map and product rules.
