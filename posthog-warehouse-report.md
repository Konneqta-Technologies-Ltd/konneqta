# PostHog Data Warehouse Setup Report

## Summary

The wizard detected **Supabase** as a data source in this project (via `@supabase/supabase-js` in `package.json`). Supabase is connected to PostHog as a **Postgres** source using Supabase's Session pooler.

Credentials were not provided interactively, so the source was not created automatically. Manual setup is required via the PostHog app.

---

## Changes Made

No source-code files were modified. This skill only configures external data connections in PostHog.

---

## Sources

| Source | Kind | Status |
|--------|------|--------|
| Supabase | Postgres | Needs browser setup |

---

## Manual Steps Required

1. Open the PostHog new-source URL:
   **https://us.posthog.com/project/421881/data-warehouse/new-source?kind=Postgres**

2. Fill in the connection form with these Supabase-specific values:

   | Field | Value |
   |-------|-------|
   | Host | `aws-0-<region>.pooler.supabase.com` (Session pooler — see Supabase → Settings → Database → Connection pooling) |
   | Port | `6543` |
   | User | `postgres.<your-project-ref>` |
   | Password | Database password from Supabase → Settings → Database (NOT the anon/service_role JWT) |
   | Database | `postgres` |
   | Schema | `public` |

3. Select the tables you want to sync into PostHog's data warehouse.

4. PostHog connects from its own infrastructure — ensure your Supabase project allows connections from PostHog's egress IPs. Check the [PostHog docs](https://posthog.com/docs/cdp/sources/postgres) for the current IP list.

---

## Files Modified or Created

| File | Action |
|------|--------|
| `posthog-warehouse-report.md` | Created (this file) |
