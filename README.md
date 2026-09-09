# Understudy

**Understudy helps small businesses capture the knowledge their employees carry in their heads before they leave.**

When someone leaves a small business, they often take important knowledge with them: which customers to avoid, why a particular route doesn't work, how a process actually gets done, or what went wrong the last time someone tried something.

Most documentation tools turn this into neat notes and checklists. Understudy takes a different approach. It keeps the **reasoning and context behind the knowledge**, including who said it, what happened, and when it was learned.

## What it does

Understudy is a working product demo built around a fictional Lagos logistics company called **FastTrack Dispatch**.

It has four main parts:

### Knowledge

A central view of everything the business has learned from its employees.

Each piece of knowledge keeps its original context and source instead of reducing it to a generic statement.

The system also highlights:

* Conflicting information
* Knowledge that may be becoming outdated
* Topics known by only one person
* Areas where the business has very little information

### Ask

Instead of searching through documentation, users can ask questions in natural language.

For example:

> Who shouldn't we use for urgent jobs?

Understudy builds a briefing from the knowledge it has collected and shows where each piece of information came from.

If two employees disagree, **both perspectives are shown**.

If the business has never recorded an answer, Understudy returns a knowledge gap instead of making one up.

### Coverage

Coverage shows which employees hold knowledge about which parts of the business.

This makes it easy to identify risks such as:

* Only one person knows how a particular route works
* Only one person understands a critical process
* A topic has conflicting information
* Important areas have barely been documented

This helps answer a practical question:

**"If someone left this week, what would we suddenly not know?"**

### Capture

Capture simulates an interview with an employee.

The system identifies areas where more information is needed and asks targeted follow-up questions instead of running through a generic questionnaire.

The employee's answer is then extracted into structured knowledge, while still preserving the original reasoning and context.

If the new information conflicts with something already recorded, Understudy keeps both sides instead of silently overwriting the existing knowledge.

## Demo

The demo uses **FastTrack Dispatch**, a fictional Lagos logistics business.

It comes with seeded data so you can explore the product immediately.

Try these flows:

1. Open **Knowledge** and explore the existing records.
2. Go to **Ask** and ask:
   `Who shouldn't we use for urgent jobs?`
3. Notice that the system surfaces both sides of the disagreement rather than choosing one.
4. Ask about something that has never been documented and see how the system identifies a knowledge gap.
5. Open **Coverage** to see where knowledge is concentrated or missing.
6. Use **Capture** to simulate an employee interview and add new knowledge.
7. Explore the handover flow to see what information would matter if someone became unavailable.

## Running locally

### Requirements

* Node.js 20+
* An Anthropic API key is optional.

The main Capture, Ask, and handover flows can run using the local fallback without an API key.

### Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open:

```text
http://127.0.0.1:43127
```

## Tech stack

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS 4
* Zustand
* Anthropic API
* Claude


The demo intentionally has **no authentication or database**. Data is persisted locally in the browser.

## Why I built it

Understudy explores a simple question:

**What if business knowledge was treated as something that needs to be actively captured, challenged, and handed over, rather than something people are expected to write down themselves?**

The goal isn't to build another company wiki.

It's to make the knowledge inside people's heads easier to capture and pass on.

## License


