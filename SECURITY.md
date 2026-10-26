# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

## Reporting a vulnerability

Please do not open public issues for security vulnerabilities. Email the maintainer at lavishgangwar36@gmail.com with:

- A description of the issue
- Steps to reproduce
- The affected versions
- Suggested mitigation (if any)

Reports are acknowledged within 5 business days.

## Scope

In scope: authentication, session management, authorization (RBAC/project membership), import/export sanitization, audit logging, and CSRF/rate-limiting defenses.

Out of scope: third-party systems scanned by imported findings, and consumer deployment environments.

## Security baseline (v1)

- Email + password login only; no public self-service registration
- Passwords hashed with argon2id; never stored plaintext; never logged
- Server-side sessions stored in PostgreSQL; session IDs are cryptographically random and contain no user data
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production
- CSRF protection (double-submit cookie) for state-changing requests
- Login and write rate limiting
- Generic authentication errors (no account enumeration)
- CORS restricted to explicit trusted origins (no wildcard)
- Security headers via Helmet
- Parameterized database access through Drizzle ORM
- Request-body limits, schema validation, page-size caps, rate limits
- CSV formula injection protection on exports
- Audit events for meaningful changes; secrets never logged

## Disclosure

Accepted reports receive credit and a coordinated release timeline. No bounty is offered at this stage. Automated checks do not replace a professional security review.
