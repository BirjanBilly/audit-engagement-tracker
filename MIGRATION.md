# Migration Runbook

This file is intentionally a starting template during Act 1. Complete it while
performing Act 2; do not write it retrospectively.

## Source project

- Project reference: `<OLD_PROJECT_REF>`
- Project URL: `<OLD_PROJECT_URL>`
- Creation timestamp: `<UTC timestamp>`

## Target project

Do not create this project until after the `act-1-complete` tag has been pushed.

- Project reference: `<NEW_PROJECT_REF>`
- Project URL: `<NEW_PROJECT_URL>`
- Creation timestamp: `<UTC timestamp>`

## Preconditions

- [ ] `act-1-complete` exists on GitHub.
- [ ] Production is in read-only mode.
- [ ] The source database connection string is held only in an environment variable.
- [ ] `migration-artifacts/` is excluded from Git.
- [ ] The source storage object count has been checked.

## Commands

Record the exact commands and their exit results here during Act 2.

## Row-count verification

| Relation | Old | New | Match |
|---|---:|---:|:---:|
| `public.clients` |  |  |  |
| `public.engagements` |  |  |  |
| `public.time_entries` |  |  |  |
| `public.seed_import_rows` |  |  |  |
| `auth.users` |  |  |  |
| `auth.identities` |  |  |  |
| `storage.buckets` |  |  |  |
| `storage.objects` |  |  |  |

## Authentication verification

- [ ] Reviewer user UUID and email match.
- [ ] Second user UUID and email match.
- [ ] Both original passwords work against the target project.
- [ ] Existing sessions were intentionally invalidated and users re-authenticated.

## Cutover

Record the Vercel environment variables changed, deployment URL, and smoke-test
results. Do not paste secret values.

## Rollback plan

1. Set `APP_READ_ONLY=true` in Vercel and redeploy.
2. Restore the old project URL, anon key, and service-role key in Vercel.
3. Redeploy and verify the old project counts.
4. Keep the target isolated while investigating.
5. Do not write to or delete the source project.
