# VulnLedger — Incident Response

**Version:** 1.0.0 MVP

## Purpose

Describes how the maintainer and operators respond to suspected or confirmed security incidents affecting VulnLedger deployments. This is a living document; update it after each incident.

## Roles

- **Maintainer:** Lavish Gangwar (lavishgangwar36@gmail.com) — receives reports, coordinates response, publishes advisories.
- **Operator:** the person or team running a self-hosted VulnLedger instance — contains and recovers their deployment.

## Severity levels

| Severity | Definition | Response time |
|---|---|---|
| Critical | Active exploitation, credential exposure, or cross-project data exposure | Immediate (acknowledge < 24 h) |
| High | Authentication/authorization bypass, session compromise | < 3 business days |
| Medium | Information disclosure, audit-log gap, CSRF weakness | < 10 business days |
| Low | Defense-in-depth improvement, minor hardening | Next release |

## Response process

1. **Receive:** Acknowledge the report and assign a severity.
2. **Contain:** Operator should rotate exposed credentials, revoke sessions (delete rows from `sessions` table), and restrict network access if active exploitation is suspected.
3. **Investigate:** Review audit events (`audit_events` table), PostgreSQL logs, and access logs. Determine affected users/projects/findings.
4. **Remediate:** Patch the vulnerability, rotate secrets, re-hash affected credentials if needed, and redeploy.
5. **Recover:** Restore service, verify the fix, notify affected users.
6. **Post-mortem:** Document root cause, timeline, and preventive actions.

## Evidence preservation

- Do not delete `audit_events`, `sessions`, or PostgreSQL logs during an investigation.
- Export relevant audit records before making changes.
- Never transmit passwords or password hashes by email.

## Reporting

Use the process in [`SECURITY.md`](SECURITY.md). Do not disclose potential vulnerabilities in public issues or pull requests.

## Templates

None maintained yet — create an incident record (date, severity, reporter, summary, actions, resolution) for each confirmed incident.
