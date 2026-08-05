# Migration Runbook

This runbook records the completed Act 2 migration from the original Supabase
project to a fresh target project.

## Source project

- Project reference: `wqfvlqdmqivrdspmpewh`
- Project URL: `https://wqfvlqdmqivrdspmpewh.supabase.co`
- Creation timestamp: `2026-08-05 10:02:41 UTC`
- Region: West EU (Ireland)

## Target project

The target was created only after the `act-1-complete` tag had been pushed.

- Project reference: `sblnwjodggudplhxrijm`
- Project URL: `https://sblnwjodggudplhxrijm.supabase.co`
- Creation timestamp: `2026-08-05 12:51:08 UTC`
- Region: Central EU (Frankfurt)

## Preconditions and operational controls

- [x] `act-1-complete` existed on GitHub before the target was created.
- [x] Production was placed in read-only mode before the migration.
- [x] Source and target database URLs were stored only in ignored environment files and process variables.
- [x] Database passwords containing reserved URL characters were percent-encoded.
- [x] `migration-artifacts/` was excluded from Git.
- [x] Source Storage contained zero objects.
- [x] The source project was retained and was not written to during or after cutover.
- [x] Production was returned to writable mode only after verification succeeded.

## Exact dump commands

```powershell
npx supabase db dump `
  --db-url $env:OLD_DATABASE_URL `
  -f migration-artifacts/roles.sql `
  --role-only

npx supabase db dump `
  --db-url $env:OLD_DATABASE_URL `
  -f migration-artifacts/schema.sql

npx supabase db dump `
  --db-url $env:OLD_DATABASE_URL `
  -f migration-artifacts/data.sql `
  --use-copy `
  --data-only `
  -x "storage.buckets_vectors" `
  -x "storage.vector_indexes"

npx supabase db dump `
  --db-url $env:OLD_DATABASE_URL `
  -f migration-artifacts/history_schema.sql `
  --schema supabase_migrations

npx supabase db dump `
  --db-url $env:OLD_DATABASE_URL `
  -f migration-artifacts/history_data.sql `
  --use-copy `
  --data-only `
  --schema supabase_migrations
```

## Role handling

The application created no custom PostgreSQL login roles. Both hosted projects
already contained Supabase's platform-managed roles:

- `anon`
- `authenticated`
- `service_role`

The generated `roles.sql` file was retained as audit evidence but was not
replayed. Replaying it attempted to alter the reserved internal
`supabase_admin` role, which hosted non-superuser connections cannot modify.

## Exact successful restore commands

A permission-safe copy of `schema.sql` was prepared by commenting out any
cross-project ownership statements targeting `supabase_admin`. In this
migration, zero such ownership statements were found.

The incomplete migration-history-only restore from the failed attempt was
removed:

```powershell
psql `
  "--dbname=$env:NEW_DATABASE_URL" `
  "--set=ON_ERROR_STOP=1" `
  "--command=drop schema if exists supabase_migrations cascade;"
```

The application schema, data, Auth rows, grants, indexes, policies and
functions were restored in one transaction:

```powershell
psql `
  "--dbname=$env:NEW_DATABASE_URL" `
  "--single-transaction" `
  "--set=ON_ERROR_STOP=1" `
  "--file=migration-artifacts/schema.clean.sql" `
  "--command=SET session_replication_role = replica;" `
  "--file=migration-artifacts/data.sql"
```

Migration history was then restored transactionally:

```powershell
psql `
  "--dbname=$env:NEW_DATABASE_URL" `
  "--single-transaction" `
  "--set=ON_ERROR_STOP=1" `
  "--file=migration-artifacts/history_schema.sql" `
  "--file=migration-artifacts/history_data.sql"
```

Verification was executed with:

```powershell
npx tsx `
  --env-file=.env.migration.local `
  scripts/verify-migration.ts
```

## Row-count and full-row digest verification

| Relation | Old | New | Count match | Digest match |
|---|---:|---:|:---:|:---:|
| `public.clients` | 388 | 388 | Yes | Yes |
| `public.engagements` | 420 | 420 | Yes | Yes |
| `public.time_entries` | 401 | 401 | Yes | Yes |
| `public.seed_client_keys` | 388 | 388 | Yes | Yes |
| `public.seed_import_rows` | 420 | 420 | Yes | Yes |
| `public.user_preferences` | 0 | 0 | Yes | Yes |
| `auth.users` | 2 | 2 | Yes | Yes |
| `auth.identities` | 2 | 2 | Yes | Yes |
| `storage.buckets` | 0 | 0 | Yes | Yes |
| `storage.objects` | 0 | 0 | Yes | Yes |

All compared counts and complete-row SHA-256 digests matched.

## Authentication verification

- [x] Reviewer user UUID and email migrated.
- [x] Second user UUID and email migrated.
- [x] Both original passwords worked against the target project.
- [x] Users could re-authenticate without registering again.
- [x] New project signing keys were used after cutover.

## Extensions and Storage

- Required PostgreSQL extensions were present on the target.
- `pgcrypto` was explicitly checked and already existed.
- Source and target Storage bucket counts were both zero.
- Source and target Storage object counts were both zero.
- No separate object-byte transfer was required.

## Configuration-only cutover

The application code was not changed for the database cutover. The following
Vercel production variables were updated without recording their secret values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_READ_ONLY`

`APP_READ_ONLY` was set to `true` before migration and restored to `false`
after all verification passed. Vercel was redeployed after each environment
change.

Production URL:

```text
https://audit-engagement-tracker.vercel.app
```

Smoke tests after cutover:

- Reviewer login passed.
- Second-user login passed.
- Existing clients were readable.
- Existing engagements and time entries were readable.
- The application used the target project.

## Incident and recovery note

The first restore attempt replayed `roles.sql` and failed when it attempted to
modify the reserved `supabase_admin` role. Because the restore used
`--single-transaction`, the application schema/data portion rolled back. A
migration-history-only partial restore was removed before retrying.

The successful retry:

1. retained `roles.sql` as evidence;
2. confirmed the required platform roles existed on both projects;
3. skipped replaying platform-managed role alterations;
4. restored schema, data and Auth rows transactionally;
5. restored migration history;
6. verified counts and full-row digests;
7. verified both original user passwords.

## Rollback plan

1. Set `APP_READ_ONLY=true` in Vercel and redeploy.
2. Restore the source project URL, anon key and service-role key in Vercel.
3. Redeploy.
4. Verify the source project row counts and reviewer login.
5. Keep the target isolated while investigating.
6. Do not write to, delete or otherwise modify the source project.

## Final status

- Migration result: successful
- Zero data loss verification: passed
- Auth migration verification: passed
- Configuration-only cutover: passed
- Source retained: yes
- Git checkpoint: `act-2-complete`
