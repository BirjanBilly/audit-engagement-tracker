# Debug and AI Assistance Log

Keep this file open throughout the assessment. Add an entry whenever an AI tool
writes, changes, diagnoses, or recommends code. Do not reconstruct it at the end.

## Entry template

### YYYY-MM-DD HH:MM BST — Short title

**Task**

What was being attempted.

**AI contribution**

Exactly what the AI generated or suggested, including file names.

**My review and decision**

What I checked, what I accepted, and what I changed or rejected.

**Commands/evidence**

```text
command or test result
```

**Outcome**

Accepted, modified, reverted, or unresolved.

---

## Initial entry to customise

### 2026-08-05 HH:MM BST — Repository and schema plan

**Task**

Design a migration-first Supabase application for the Audit Engagement Tracker.

**AI contribution**

ChatGPT supplied a staged code kit containing SQL migrations, a CSV ingest
script, Supabase Auth integration, API infrastructure, UI code, and operational
runbooks.

**My review and decision**

Before using it I reviewed the schema, RLS policies, dedupe keys, migration
commands, and API failure behaviour. I will record every override in later
entries rather than claiming the generated code was handwritten.

**Commands/evidence**

```text
npm run typecheck
npm test
npx supabase db reset
```

**Outcome**

Replace this line with the actual result after running the checks.

## Act 1 implementation record

AI supplied the initial migration, ingest scripts, application code, and troubleshooting guidance.
I reviewed the migration, applied it to the hosted project, verified the imported counts, tested RLS, and tested reviewer authentication.
I replaced the corrupted TypeScript Next configuration with a minimal ESM configuration after confirming the original file could not be transpiled.
