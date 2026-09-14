# Understudy V2 design system

This design direction is derived from the Linear-style analysis in VoltAgent/awesome-design-md and follows the anti-pattern guidance in pbakaus/impeccable. It is adapted for Understudy rather than copied as a brand clone.

## Atmosphere

Quiet, technical, evidence-heavy, and operational. Understudy should feel like infrastructure for serious work transitions, not an HR portal and not a generic AI dashboard.

Use dark surfaces with restrained contrast, hairline borders, compact controls, and one primary accent. Let structured product UI be the visual interest. Avoid decorative gradients, oversized glow effects, nested-card clutter, and rounded-square icon tiles above headings.

## Color roles

- Canvas: #08090b
- Sidebar: #0b0c0e
- Surface 1: #0f1012
- Surface 2: #141518
- Surface 3: #191a1e
- Primary text: #f7f8f8
- Secondary text: #a0a5ad
- Subtle text: #747982
- Faint text: #565b63
- Hairline border: #23252a
- Strong border: #34373d
- Primary accent: #5e6ad2
- Primary hover: #7884ef
- Success: #4aad75
- Warning: #d5a94f
- Risk: #e35d6a

Use accent purple only for primary action, selected state, focus, and important AI-context cues. Semantic colors are reserved for actual status meaning.

## Typography

Use Geist Sans for UI and Geist Mono for IDs, readiness values, source counts, and compact technical metadata.

Hierarchy:
- Page title: 27–32px, 600, strong negative tracking
- Workspace title: 20–22px, 600
- Section title: 13–14px, 500
- Primary row text: 11.5–12.5px, 500
- Body / explanation: 10–12px, 400
- Metadata: 9–10.5px

Keep display weight controlled. Avoid giant marketing typography inside the product.

## Spacing

Base rhythm: 4px.
Common increments: 4, 8, 12, 16, 24, 32.

Product rows should be compact enough to scan. Major surfaces get 16–24px padding. Avoid whitespace that turns operational screens into landing pages.

## Shape

- Controls: 8px radius
- Main panels: 12px radius
- Badges: 4–6px radius
- Avatars and progress pills: full radius only when semantically appropriate

Do not make every container pill-shaped.

## Surfaces and depth

Depth comes from surface stepping and 1px borders, not shadows. Use shadows only when an actual overlay must separate from the canvas.

## Core components

### App shell
Fixed desktop sidebar, compact mobile header. Current navigation state uses a lifted surface and accent-tinted icon.

### Transition row
Person, role, transition type, target date, successor, readiness. Designed for scanning rather than card browsing.

### Readiness bar
Transparent percentage plus progress indicator. The score must always be explainable through component metrics.

### Evidence source row
Source icon, title, provider, provenance class, extracted entities, and action. Provenance classes: Primary, AI-recovered, Self-reported.

### Risk row
Plain language risk, evidence-based explanation, severity. Avoid alarming decoration beyond the semantic icon/color.

### Adaptive interview
One high-value question at a time with concise evidence explanation below. Focus the user on answering, not navigating a form.

### Handover document
Reading-oriented surface, calm typography, visible source references. It should feel exportable without becoming visually disconnected from the product.

## Interaction

Use short color/opacity transitions. No bounce or elastic motion. Hover should clarify clickability, not move large elements around.

## Responsive behavior

Desktop prioritizes dense multi-column operational layouts. Tablet collapses secondary sidebars below primary content. Mobile retains the same information hierarchy but stacks rows and uses a compact top header instead of the fixed sidebar.

## Guardrails

Do:
- keep important claims traceable to evidence
- use sparse accent color
- prefer rows and sections over card grids
- make uncertainty and missing data visible
- preserve scanability

Do not:
- use gradients as decoration
- nest cards inside cards repeatedly
- use pure black/white without tinted surrounding surfaces
- use vague AI language where an operational term exists
- hide meaning behind unexplained scores
- imitate Linear branding; this is Understudy's product system
