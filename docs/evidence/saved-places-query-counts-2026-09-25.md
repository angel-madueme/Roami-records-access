# Saved Places query-count evidence — 2026-09-25

Temporary Prisma query-event logging was enabled in `lib/prisma.ts` on an isolated development server at `http://localhost:3002`. The logger was removed after measurement. Requests were run sequentially with one authenticated session and one SavedPlace (`publicId=uZb8IGc4y0b3`).

## Measured current counts

| Action | Raw Prisma events | Application queries/statements | Observed operations |
|---|---:|---:|---|
| List | 3 | 2 | `SELECT 1`, session lookup, user-scoped SavedPlace list query |
| Detail | 3 | 2 | `SELECT 1`, session lookup, combined userId/publicId lookup |
| Delete | 7 | 4 SQL statements | `SELECT 1`, session lookup, combined ownership lookup, `BEGIN`, audit insert, scoped delete, `COMMIT` |

The raw event count includes Prisma's connection `SELECT 1` and transaction-control events. The application-query count excludes `SELECT 1`, `BEGIN`, and `COMMIT` while retaining the session lookup and SavedPlace/audit statements.

## Request results

```text
LIST_STATUS 200
DETAIL_STATUS 200
DELETE_STATUS 204
```

No prior unoptimized implementation had been instrumented, so these are the current baseline counts rather than a before/after reduction. The detail and delete lookup events confirmed the ownership predicate contained both `userId` and `publicId`.
