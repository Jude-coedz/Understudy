# Supabase setup for Understudy

Step 8 adds authenticated, cross-device workspace persistence using Supabase Auth, Postgres and Row Level Security.

## 1. Create the project

Create a Supabase project on the free tier.

From **Project Settings → API**, copy:

- Project URL
- Publishable key (`sb_publishable_...`) or the legacy anon key

In the Cloudflare Worker, add runtime variables:

```text
SUPABASE_URL=<project url>
SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Do not use a service-role key in the browser or Worker runtime configuration for this feature.

## 2. Apply the database migration

Run `supabase/migrations/001_workspaces.sql` in the Supabase SQL editor.

The migration creates `public.workspaces`, enables RLS, and only allows the authenticated owner to read or mutate each workspace row.

## 3. Enable Google auth

In **Authentication → Providers → Google**, enable Google and provide the Google OAuth credentials requested by Supabase.

Add these redirect URLs in Supabase Auth URL configuration:

```text
https://understudy.ee-akede.workers.dev/auth/callback
http://127.0.0.1:43127/auth/callback
```

Set the deployed Understudy origin as the Site URL.

## 4. What happens after sign-in

Understudy keeps a local browser copy for fast startup, but the authenticated account becomes the durable source of persistence.

On first sign-in:

1. existing local workspaces are captured before the identity changes;
2. remote workspaces are fetched under the authenticated Supabase user;
3. local and remote copies are reconciled by `updatedAt`;
4. local workspaces are migrated to the Supabase user ID;
5. the merged result is written to Postgres;
6. future `saveWorkspace` events sync automatically.

This preserves an existing trial workspace instead of abandoning it when the user creates an account.

## 5. Security model

The browser receives only the Supabase publishable/anon key and the signed-in user's access token. Postgres RLS enforces owner isolation with `auth.uid() = owner_id`.

No service-role credential is shipped to the browser. Source bodies remain inside each authenticated workspace JSON payload and cannot be selected by another authenticated user under the Step 8 policies.

## 6. Current scope

Step 8 provides owner-only account persistence and cross-device recovery. Team membership/sharing is intentionally deferred to the later shared-transition build so collaboration permissions can be designed explicitly instead of weakening the owner RLS policy prematurely.
