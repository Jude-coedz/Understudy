# Google Drive setup for Understudy

Understudy uses Google Identity Services + Google Picker in the browser. The user explicitly chooses a file, and Understudy requests the narrow `drive.file` scope instead of broad `drive.readonly` access.

## Why this scope

`drive.file` gives the app access only to files the user opens or shares with the app. It is the recommended Drive scope for Picker-based workflows and avoids granting Understudy access to the user's entire Drive.

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable **Google Drive API**.
3. Enable **Google Picker API**.
4. Configure the OAuth consent screen.
5. Add the non-sensitive scope:
   - `https://www.googleapis.com/auth/drive.file`
6. Create an **OAuth client ID** for a Web application.
7. Add the deployed Understudy origin to **Authorized JavaScript origins**, for example:
   - `https://understudy.<your-workers-subdomain>.workers.dev`
8. Create a browser API key and restrict it:
   - restrict by HTTP referrer to the Understudy production origin;
   - restrict API usage to Google Picker API / Drive APIs needed by the app.

## Cloudflare variables

In Cloudflare Workers → Understudy → Settings → Variables and Secrets, add:

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web OAuth client id>
NEXT_PUBLIC_GOOGLE_API_KEY=<restricted browser API key>
```

These values are browser-facing identifiers, not server secrets. They are prefixed `NEXT_PUBLIC_` because the Google Picker flow runs in the user's browser. Restrict the API key in Google Cloud rather than treating it as a secret.

`GEMINI_API_KEY` is different: it remains a Cloudflare **Secret** and must never use a `NEXT_PUBLIC_` prefix.

## Current supported Drive files

The current portfolio build can read:

- Google Docs, exported as plain text
- Google Sheets, exported as CSV
- text/plain files
- Markdown / JSON / CSV text files

PDF and DOCX parsing should be added as a separate ingestion layer rather than pretending they are readable today.

## User isolation

The current public trial namespaces local workspace data by the connected Google account ID when Google is connected, otherwise by a generated browser guest ID. Different visitors therefore do not share the same transition state.

This is intentionally a trial architecture, not the final persistence layer. Cross-device persistence should move transitions, sources, reviews, and interview answers into an authenticated database with per-user / per-workspace authorization (for example Supabase Auth + Postgres RLS or Cloudflare D1 with a server-side session layer).
