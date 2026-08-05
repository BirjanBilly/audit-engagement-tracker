# Audit Engagement Tracker

A migration-first Next.js and Supabase application for tracking audit clients,
engagements, and time entries.

## Act 1 scope

- SQL-only schema migrations in `supabase/migrations/`
- Supabase email/password authentication
- Anonymous read-only access to `clients`
- Authenticated read/write access to core tables
- Idempotent, audited ingestion of `data/seed_data.csv`
- Minimal deployed UI for client browsing, engagement creation, and time logging
- Environment-variable-only configuration

## Local setup

```powershell
Copy-Item .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run seed:profile
npm run seed:ingest
npm run dev
```

For a hosted project, set `DATABASE_URL` to the session-pooler connection string,
link the project, and run `npx supabase db push` before ingestion.

## Seed deduplication

The import uses two SHA-256 keys held in separate import-control tables, leaving
the required core table shapes clean:

1. Client key: normalized client name, country, and parsed fiscal-year-end date.
2. Source-row key: normalized name, country, original fiscal-year-end text,
   status, original hours text, and entry date.

The supplied file is expected to produce 420 unique source rows, 388 clients,
420 engagements, and 401 valid time entries. Invalid hours do not become zero;
the client and engagement are retained and the issue is recorded in
`seed_import_rows`.

## RLS model

- `anon`: may select `clients`; receives no write grants or policies.
- `authenticated`: may select, insert, update, and delete core rows.
- Import-control, API-key, rate-limit, and idempotency tables: server-only.
- `user_preferences`: users may access only their own row.

## Security

Real secrets must never be committed. The service-role key is server-only and
must not appear in browser code, logs, screenshots, or documentation.

## Later acts

Complete `MIGRATION.md`, replace `API_GUIDE.md`, and record all AI-assisted work
in `DEBUG_LOG.md` as the assessment progresses.

## Act 1 verification

- Live app: https://audit-engagement-tracker.vercel.app
- Seed input rows: 475
- Canonical duplicates removed: 55
- Clients: 388
- Engagements: 420
- Time entries: 401
- Auth users: 2
- The second ingest created zero duplicate records.
- Hosted RLS verification passed.
- Unit tests, lint, typecheck, and production build passed.
