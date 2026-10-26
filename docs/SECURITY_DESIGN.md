# VulnLedger — Security Design

**Version:** 1.0.0 MVP

---

## Authentication

- **Factor:** email + password only. No public self-service registration; accounts are created by an administrator via the `admin:create` CLI (first admin) or project membership flow.
- **Password hashing:** argon2id via the `argon2` package (memory cost 64 MiB, 3 iterations, 4 parallelism, 32-byte hash, 16-byte salt). Passwords are never stored plaintext, never logged, never returned.
- **Generic failures:** login returns the same `invalid_credentials` message whether the account does not exist, is disabled, or the password is wrong — preventing account enumeration.
- **Rate limiting:** login limited to 20 attempts per 15-minute window per IP; write routes limited to 120 per minute per IP.

## Sessions

- **Storage:** server-side sessions in PostgreSQL via `connect-pg-simple`.
- **Session ID:** cryptographically random 32 bytes (hex-encoded), contains no user data.
- **Cookie:** `HttpOnly`, `SameSite=Lax`, `Secure` when `SESSION_COOKIE_SECURE=true` or `NODE_ENV=production`, 4-hour max age, rolling renewal.
- **Rotation:** session regenerated on login (prevents session fixation); destroyed on logout.
- **Fail closed:** the API refuses to start if `SESSION_SECRET` is missing.

## Authorization

- **Roles:** `admin` (installation-level) and `member` (project-level).
- **Model:** every finding is scoped to a project. Reads and writes verify project membership server-side. Frontend hiding is not authorization.
- **Admin routes** (`requireAdmin`): project creation, membership management.
- **Member routes** (`requireAuth`): own projects' findings, imports, exports, audit history.
- **Status transitions:** validated against a documented transition matrix; invalid transitions rejected.
- **Assignee:** must be a member of the finding's project.

## Import / export

- **Import format:** JSON only, validated with Zod schemas. Max 2 MiB payload, max 5,000 records.
- **Preview / confirm:** dry-run preview performs no writes; explicit confirmation commits transactionally.
- **Deduplication:** project + source + ruleId + fingerprint + component; titles alone never trigger dedup. Failed batch leaves no partial results (transaction rollback).
- **Export:** JSON and CSV, authorization-aware, bounded pagination. CSV cells beginning with `=`, `+`, `-`, `@`, or control characters are prefixed with a tab to neutralize formula injection; RFC 4180 escaping for delimiters/quotes/newlines.
- **Trust:** imported content is never executed, rendered as raw HTML, used as authorization, or fetched.

## Audit

- Events recorded for: login/logout (summary only), project membership changes, finding create/update/delete, import commits, exports.
- Each event: actor, project/entity reference, event type, timestamp, sanitized summary.
- No passwords, hashes, session IDs, tokens, cookies, or unrestricted raw evidence stored.
- Cross-project audit history not readable.

## Network / headers

- **CORS:** explicit trusted origins only; no wildcard.
- **Headers:** Helmet (content security policy disabled because the frontend is served separately; referrer policy `strict-origin-when-cross-origin`).
- **Body limits:** 2 MB JSON request limit.

## Configuration security

- `.env`, database dumps, real data, tokens, private keys excluded from version control.
- `.env.example` contains only harmless placeholders.
- Required production secrets (`DATABASE_URL`, `SESSION_SECRET`) validated at startup; API fails closed when missing.

## Non-goals (documented)

- No outbound URL fetching in v1.
- No scanner, exploit runner, SARIF import, billing, OAuth/SSO, email delivery.
