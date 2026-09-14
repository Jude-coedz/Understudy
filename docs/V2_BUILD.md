# Understudy V2 build map

## Current vertical slice

- `/` — V2 overview dashboard
- `/transitions` — active transition list
- `/transitions/maya-okafor` — full transition workspace demo
- `/continuity` — continuity-risk view
- `/ask` — existing grounded Ask flow, now inside the V2 shell
- `/integrations` — evidence-source and planned connector map

## Transition workspace tabs

- Overview
- Sources
- Work map
- Interview
- Handover
- Questions

The Sources tab includes the first AI Context Import flow: generate a structured recovery prompt, run it in ChatGPT/Claude/Gemini, and import the reviewed result as AI-recovered evidence.

## Next build sequence

1. Replace static transition data with the V2 TypeScript/domain model and persistence adapter.
2. Add document upload and extraction.
3. Add Gemini extraction + gap analysis behind model-agnostic service functions.
4. Add public GitHub repository analysis.
5. Make interview responses update the evidence graph and readiness score.
6. Add grounded Ask-the-Handoff responses with source references.
7. Add Markdown/PDF export.

## Design references

The V2 design system is documented in `/DESIGN.md`. Product truth and scope live in `/PRODUCT.md`.
