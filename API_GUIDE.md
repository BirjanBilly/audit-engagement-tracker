# Audit Engagement Tracker API Guide

## Base URL and versioning

Production base URL:

```text
https://audit-engagement-tracker.vercel.app/v1
```

Every route is versioned under `/v1/`. A future incompatible API would be
introduced under a new version rather than silently changing these contracts.

Interactive OpenAPI documentation is available at `/docs`; the raw OpenAPI 3.1
document is available at `/openapi.json`.

## Authentication setup

Every `/v1/` route requires this header:

```http
Authorization: Bearer <API_KEY>
```

Generate the reviewer key against the migrated Supabase project:

```powershell
$env:API_KEY_NAME = "Crebain reviewer"
npm run api:create-key
```

The command prints the raw key once. The database stores only a SHA-256 hash and
a short non-secret prefix. Missing, inactive, or incorrect keys return `401` in
the standard error envelope.

## Curl quickstart

Set shell variables without putting the key in command history where possible:

```bash
export BASE_URL="https://audit-engagement-tracker.vercel.app"
export API_KEY="creb_live_REPLACE_ME"
```

Confirm the API:

```bash
curl --silent --show-error \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/"
```

List five clients:

```bash
curl --silent --show-error \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/clients?limit=5"
```

Filter clients by country:

```bash
curl --silent --show-error \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/clients?country=GB&limit=25"
```

List review-stage engagements created in a period:

```bash
curl --silent --show-error \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/engagements?status=review&from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z"
```

Create a time entry:

```bash
curl --silent --show-error \
  --request POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: time-entry-2026-08-05-001" \
  --data '{
    "engagement_id": "REPLACE_WITH_ENGAGEMENT_UUID",
    "hours": 3.5,
    "entry_date": "2026-08-05",
    "description": "Planning meeting and evidence review"
  }' \
  "$BASE_URL/v1/time-entries"
```

Get a client summary:

```bash
curl --silent --show-error \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/clients/REPLACE_WITH_CLIENT_UUID/summary"
```

## Cursor pagination walkthrough

`GET /v1/clients` uses keyset pagination rather than numeric offsets. This avoids
skipping or duplicating rows when new clients are inserted between requests.

1. Call the route without `cursor`:

   ```text
   GET /v1/clients?limit=25
   ```

2. Read `pagination.next_cursor` from the response.
3. If it is non-null, pass it back unchanged and URL-encoded:

   ```text
   GET /v1/clients?limit=25&cursor=<opaque-value>
   ```

4. Continue until `next_cursor` is `null`.

The cursor is opaque and HMAC-signed. Clients must not decode, edit, or generate
it. A modified or malformed cursor returns `422`.

## Idempotency behaviour

`POST /v1/time-entries` requires `Idempotency-Key`.

- Same API key + same idempotency key + same validated body:
  - returns the original `201` body;
  - does not insert another row;
  - sets `Idempotency-Replayed: true` on a replay.
- Same API key + same idempotency key + different validated body:
  - returns `409 IDEMPOTENCY_CONFLICT`;
  - creates no row.
- A different API key may independently use the same textual idempotency key.

The database transaction takes an advisory lock on the API-key/key pair, so two
simultaneous requests cannot both pass the lookup and insert duplicate rows.

## Standard errors

Every API error has one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "hours",
        "message": "Hours must be greater than zero."
      }
    ],
    "request_id": "6fdca759-d7f0-49a0-818d-b8272aa655dc"
  }
}
```

Quote `request_id` when reporting a problem. Server logs use the same ID but do
not expose stack traces or raw database errors to the caller.

Common statuses:

| Status | Meaning |
|---:|---|
| 401 | Missing or invalid API key |
| 404 | Requested client or engagement does not exist |
| 409 | Idempotency key was reused with a different body |
| 422 | Query, path, JSON, or header validation failed |
| 429 | Per-key rate limit exceeded |
| 500 | Generic internal failure; no stack trace is returned |

## Rate limits

Each API key receives 60 requests per fixed UTC minute. Every authenticated
response includes:

```text
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1785921660
```

`X-RateLimit-Reset` is the Unix timestamp for the start of the next window.
Request 61 in the same window returns `429` with the same headers.

The counter is stored and incremented atomically in PostgreSQL. It therefore
works across separate Vercel serverless instances; it is not an in-memory map.
The deliberate trade-off is fixed-window boundary burstiness.

## Changelog

### v1.0.0 鈥?Initial release

- Added API-key authentication.
- Added cursor-paginated client listing and country filtering.
- Added engagement status and created-at filters.
- Added atomic idempotent time-entry creation.
- Added aggregate client summaries.
- Added consistent errors, request IDs, rate-limit headers, OpenAPI, and this
  hand-written guide.

