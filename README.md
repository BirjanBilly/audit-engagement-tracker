# Audit Engagement Tracker

A production-deployed Next.js 16 and Supabase application for tracking audit
clients, engagements, status, and time. The project was built as four explicit
assessment checkpoints with annotated Git tags.

## Links

- Live application: `https://audit-engagement-tracker.vercel.app`
- API documentation: `https://audit-engagement-tracker.vercel.app/docs`
- Raw OpenAPI: `https://audit-engagement-tracker.vercel.app/openapi.json`
- Repository: `https://github.com/BirjanBilly/audit-engagement-tracker`

Reviewer credentials and secret verification keys are supplied separately and
are deliberately absent from Git.

## Architecture

```text
Browser
  鈹溾攢 Supabase SSR client with email/password session cookies
  鈹溾攢 Authenticated UI queries protected by RLS
  鈹斺攢 Responsive Next.js App Router interface

Partner API client
  鈹斺攢 /v1 Next.js Route Handlers
       鈹溾攢 hashed API-key lookup
       鈹溾攢 atomic PostgreSQL rate limit
       鈹溾攢 Zod input validation
       鈹溾攢 signed cursor pagination
       鈹斺攢 atomic PostgreSQL idempotency transaction

Supabase PostgreSQL
  鈹溾攢 clients
  鈹溾攢 engagements
  鈹溾攢 time_entries
  鈹溾攢 seed import audit/control tables
  鈹溾攢 user first-run preference
  鈹斺攢 API key/rate/idempotency tables
```

## Required environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable | Surface | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Current Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server | Legacy anon key used with RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | `/v1` internal database work |
| `DATABASE_URL` | Local scripts only | Seed and count scripts |
| `APP_READ_ONLY` | Server | Disables every UI mutation during migration |
| `CURSOR_SECRET` | Server only | Signs opaque pagination cursors |
| `NEXT_PUBLIC_SITE_URL` | Browser/server | Production origin |

## Local development

```powershell
Copy-Item .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run seed:profile
npm run seed:ingest
npm run auth:create-users
npm run dev
```

Run checks before every checkpoint:

```powershell
npm run typecheck
npm run lint
npm test
npm run verify:counts
npm run verify:rls
```

## Database and migration design

All schema changes originate in `supabase/migrations/`. No assessment table is
created in the Dashboard. The Act 1 migration deliberately includes the later
API-support structures; reading all four acts in advance made a configuration-
only Act 2 cutover possible.

The core business tables retain the exact requested fields. Import idempotency
is implemented in separate control tables rather than adding CSV-specific
columns to `clients`, `engagements`, or `time_entries`.

Foreign keys use `ON DELETE RESTRICT` for engagements and time entries. Audit
time should not disappear because a parent row was deleted accidentally. A
future deliberate deletion workflow should archive or explicitly reassign
records first.

## Seed ingest policy

The supplied CSV contains 475 input rows. The canonical ingest result is:

| Metric | Expected |
|---|---:|
| Canonical duplicate rows | 55 |
| Unique source rows | 420 |
| Clients | 388 |
| Engagements | 420 |
| Valid time entries | 401 |
| Unique rows without a valid time entry | 19 |

### Dedupe keys

- Client key: SHA-256 of normalized name, normalized country, and parsed
  fiscal-year-end date.
- Source-row key: SHA-256 of normalized name, country, original normalized
  fiscal-year-end text, status, original normalized hours text, and entry date.

A CSV line number is not part of either key, so reordering the file does not
create new records. PostgreSQL advisory locks make the script safe against two
concurrent runs, not merely two sequential runs.

### Bad-row treatment

- Blank countries become `NULL`.
- `31/12/2026` becomes `2026-12-31`.
- Blank and `N/A` fiscal year ends become `NULL` with an audit issue.
- `Dec 31st`, `2026-13-45`, and `31-06-2026` become `NULL` with an audit issue.
- Missing, nonnumeric, zero, and negative hours never become fabricated zeroes.
  The client and engagement survive; no time entry is created.
- Raw input, issues, outcome, and generated IDs are held in
  `seed_import_rows`.

Running `npm run seed:ingest` twice must leave all business row counts unchanged.

## Row-level security

SQL grants and RLS policies are both explicit:

- `anon` receives `SELECT` on `clients` and one matching select policy.
- `anon` receives no write grants and no engagement/time-entry grants.
- `authenticated` receives read/write grants and matching all-row policies on
  the three core tables.
- A user may select/insert/update only their own `user_preferences` row.
- Import and API-control tables have RLS enabled, no anon/authenticated grants,
  and no user policies. Server-side service-role work bypasses RLS.

`npm run verify:rls` proves anonymous client reads, denied anonymous writes,
denied anonymous engagement reads, and authenticated create/update/delete.

## Project migration

`MIGRATION.md` records the commands, project timestamps, complete row-count
comparison, full-row digests, authentication login tests, cutover, and rollback.
The old project remains alive and untouched after cutover.

The logical dump includes `auth.users` and password hashes, so the two Act 1
accounts retain their passwords. The target project keeps its own JWT signing
configuration; old access tokens are intentionally invalid and users sign in
again. Storage has zero buckets and objects, which is verified before and after
restore; no artificial bucket was created.

## Public API

The exact required operations are implemented under `/v1/`:

- `GET /v1/clients`
- `GET /v1/engagements`
- `POST /v1/time-entries`
- `GET /v1/clients/{id}/summary`

All require a bearer API key. Raw keys are shown once, while only SHA-256 hashes
are stored. Every error uses one envelope and a request ID. Validation failures
return `422`; raw database errors and stack traces never reach callers.

See `API_GUIDE.md` for authentication, curl, cursor pagination, idempotency,
rate limits, and changelog details.

## UX and accessibility

- Every major view has loading, populated, empty, and friendly error states.
- A first-time account sees a designed 鈥淣o clients opened yet鈥?state with a
  primary action rather than an unexplained data wall or blank page.
- Engagement status changes update immediately. A failed save restores the old
  value and displays an explicit rollback message.
- The interface has been checked at 375px and switches to stacked cards/forms.
- Native buttons, links, labels, select controls, and visible focus rings support
  keyboard-only use.
- Reduced-motion preferences disable shimmer/transition motion.

### Micro-detail

I added a fiscal-year-end urgency cue such as 鈥淵ear end in 18 days鈥?because an
audit partner needs operational priority, not merely a passive date. It adds
useful context without introducing another workflow or configuration screen.

## Defensible trade-offs

### 1. Composite imported-client identity

I used normalized name, country, and fiscal-year-end for the imported client
key. Name-only deduplication would merge conflicting records in this file. The
trade-off is that a genuine country or year-end change can produce a second
imported client requiring later human reconciliation.

### 2. PostgreSQL fixed-window rate limiting

I chose an atomic database fixed-minute counter instead of process memory or a
new Redis dependency. It behaves consistently across Vercel instances and
migrates with Supabase. The trade-off is possible burstiness across a minute
boundary; a production scale-up could move to a sliding-window Redis service.

### 3. New JWT signing configuration after migration

I preserved users and passwords but accepted re-authentication instead of
copying the old project's JWT secret. This limits secret reuse and makes the
cutover boundary explicit. The trade-off is one interrupted browser session.

## Known limitations

- The role model intentionally follows the assignment: all authenticated users
  can read/write shared business rows. A multi-firm production system would add
  organizations, memberships, and tenant-scoped RLS.
- The explicit endpoint table, rather than the scoring table's ambiguous
  鈥淔ull-CRUD鈥?phrase, defines v1 scope. Additional mutations should be added in
  a later API version or backwards-compatible minor release.
- Fixed-window rate-limit rows are cleaned opportunistically for the current
  key; a high-volume service would add a scheduled retention job.

## Security checklist

- No real credentials in Git, docs, logs, screenshots, or client bundles.
- `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_`.
- Database dumps remain under ignored `migration-artifacts/` and may contain
  auth password hashes.
- The final submission message is private and service-role keys are rotated
  after reviewer verification.

