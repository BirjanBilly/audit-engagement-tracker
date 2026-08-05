# Migration Runbook

This file is intentionally a starting template during Act 1. Complete it while
performing Act 2; do not write it retrospectively.

## Source project

- Project reference: `wqfvlqdmqivrdspmpewh`
- Project URL: `https://wqfvlqdmqivrdspmpewh.supabase.co`
- Creation timestamp: `2026-08-05 10:02:41 UTC`

## Target project

Do not create this project until after the `act-1-complete` tag has been pushed.

- Project reference: `sblnwjodggudplhxrijm`
- Project URL: `https://sblnwjodggudplhxrijm.supabase.co`
- Creation timestamp: `2026-08-05 12:51:08 UTC`

## Preconditions

- [x] `act-1-complete` exists on GitHub.
- [x] Production is in read-only mode.
- [x] The source database connection string is held only in an environment variable.
- [x] `migration-artifacts/` is excluded from Git.
- [x] The source storage object count has been checked. (Verified 0 objects).

## Commands

Record the exact commands and their exit results here during Act 2.

```powershell
npx supabase db dump --db-url $env:OLD_DATABASE_URL -f migration-artifacts/roles.sql --role-only
npx supabase db dump --db-url $env:OLD_DATABASE_URL -f migration-artifacts/schema.sql
npx supabase db dump --db-url $env:OLD_DATABASE_URL -f migration-artifacts/data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
npx supabase db dump --db-url $env:OLD_DATABASE_URL -f migration-artifacts/history_schema.sql --schema supabase_migrations
npx supabase db dump --db-url $env:OLD_DATABASE_URL -f migration-artifacts/history_data.sql --use-copy --data-only --schema supabase_migrations

psql --dbname=$env:NEW_DATABASE_URL --single-transaction --set=ON_ERROR_STOP=1 --file=migration-artifacts/roles.sql --file=migration-artifacts/schema.sql --command="SET session_replication_role = replica;" --file=migration-artifacts/data.sql
psql --dbname=$env:NEW_DATABASE_URL --single-transaction --set=ON_ERROR_STOP=1 --file=migration-artifacts/history_schema.sql --file=migration-artifacts/history_data.sql