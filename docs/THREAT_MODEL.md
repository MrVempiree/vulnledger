# VulnLedger — Threat Model

**Method:** STRIDE (adapted). Version: 1.0.0 MVP.
**Scope:** API, frontend, database, import/export, authentication, authorization.

---

## Assets

1. Finding records (title, description, evidence, remediation, severity, status)
2. User credentials (password hashes only — never plaintext)
3. Session identifiers (server-side, opaque, random)
4. Project membership and authorization boundaries
5. Audit trail (integrity and confidentiality of change history)
6. Imported content (treated as untrusted)

## Threat table

| ID | STRIDE | Threat | Impact | Likelihood | Mitigation (v1) | Residual |
|---|---|---|---|---|---|---|
| T1 | Spoofing | Attacker logs in as another user by guessing credentials | Unauthorized access to that user's projects/findings | Medium | Argon2id password hashing, 12-char minimum, login rate limiting, generic auth errors, no default passwords | Low |
| T2 | Tampering | Finding status/evidence edited without authorization | Incorrect remediation state, data integrity loss | Medium | Server-side authorization on every mutation, validated status transitions, project-scoped queries, audit events | Low |
| T3 | Repudiation | A change is made but not attributable to an actor | Unable to trace who changed a finding | Low | Audit events record actor, entity, event type, timestamp, sanitized summary | Low |
| T4 | Information disclosure | Cross-project data exposure (IDOR) | One member reads another project's findings | Medium | Server-side project-membership checks on every read; membership verified before returning data | Low |
| T5 | Information disclosure | Secrets in logs, error responses, or reports | Credentials/PII leaked | Medium | Generic error messages, no stack traces to client, redaction guidance for evidence, exports exclude passwords/hashes/session data | Low |
| T6 | Denial of service | Oversized imports, expensive queries | API unavailable or slow | Medium | Request body limit (2 MB), import record cap (5,000), page-size cap (100), rate limits on writes/login | Low |
| T7 | Elevation of privilege | Non-admin escalates to admin or accesses admin-only project management | Unauthorized project/membership changes | Medium | `requireAdmin` middleware on installation-level routes; role checked server-side | Low |
| T8 | Spoofing / Tampering | Cross-site request forgery on state-changing cookie requests | Unauthorized state change via victim's browser | Medium | Double-submit CSRF token on POST/PUT/PATCH/DELETE, `SameSite=Lax` cookies | Low |
| T9 | Tampering | CSV formula injection in exports | Malicious formulas executed when opened in spreadsheet software | Medium | Cells beginning with `=`, `+`, `-`, `@`, or control characters prefixed with tab; RFC 4180 escaping; tested | Low |
| T10 | Information disclosure | Session hijacking via XSS or network interception | Attacker impersonates authenticated user | Medium | `HttpOnly` cookies, `SameSite=Lax`, `Secure` in production, Helmet security headers | Low |
| T11 | Tampering | Audit-log injection or sensitive-data retention | Forged/tainted audit trail | Medium | Audit events written server-side only, sanitized summaries, no raw import content or secrets stored | Low |
| T12 | Supply chain | Compromised dependency | Vulnerable or malicious dependency in runtime | Medium | Lockfile committed, dependency audit in CI, minimal dependency set | Medium |

## Assets not in scope for v1

- Third-party systems referenced by imported findings (never fetched)
- Public self-service registration (not implemented)
- OAuth/SSO (not implemented)

## Review cadence

Revisit this threat model before adding: real-system scanning, outbound URL fetching, OAuth/SSO, email delivery, or multi-tenant billing.
