# VulnLedger

Self-hostable vulnerability findings management platform for small development teams and security learners.

VulnLedger is a **defensive findings management platform**, not a scanner. It helps teams import findings from existing security tools, prioritize them, assign remediation work, track status changes, and export sanitized reports. Version 1 does not scan third-party systems, crawl URLs, run exploit payloads, or automatically verify vulnerabilities.

## What's in v1

- Local/self-hosted setup with PostgreSQL
- Secure login (email + password, argon2id hashing) and server-side authorization
- Projects and project membership
- Findings create, read, update, list, filter, paginate, and status transitions
- Documented JSON import format with preview/validation before commit
- Deterministic, tested duplicate handling
- Sanitized JSON and CSV exports (CSV formula injection protected)
- Audit events for important changes
- Functional React UI connected to the real API
- Automated unit, integration, and CI checks

## Repository structure

```
vulnledger/
  apps/api/        Express + TypeScript backend
  apps/web/        React + TypeScript + Vite frontend
  packages/contracts/  Shared Zod schemas / TypeScript types
  db/              Drizzle schema + SQL migrations
  docs/            Architecture, threat model, security design, incident response, import format
  fixtures/        Example JSON import fixtures
  scripts/         first-admin bootstrap CLI
```

## Quick start

### Prerequisites

- Node.js >= 22
- pnpm >= 12
- PostgreSQL >= 16 (local or remote)

### 1. Install

```bash
pnpm install
```

### 2. Configure

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
# edit .env with your DATABASE_URL, SESSION_SECRET, etc.
```

There is **no built-in/default password**. Generate secrets:

```bash
# session secret
openssl rand -base64 32

# CSRF secret
openssl rand -base64 32
```

### 3. Set up the database

```bash
psql "$DATABASE_URL" -f db/migrations/0001_initial.sql
```

### 4. Create the first administrator

```bash
pnpm --filter api admin:create
```

You will be prompted for an email and password (minimum 12 characters). The password is hashed with argon2id and never stored plaintext.

### 5. Run the API

```bash
pnpm --filter api dev
```

The API listens on `http://localhost:3000`.

### 6. Run the UI (separate terminal)

```bash
pnpm --filter web dev
```

The UI runs on `http://localhost:5173` and proxies `/api` to the backend.

## Continuous integration

The CI workflow is shipped as `docs/github-actions-ci.yml`. Copy it into place to enable it:

```bash
mkdir -p .github/workflows
cp docs/github-actions-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow"
git push
```

It runs format check, lint, typecheck, unit/integration tests, a production build, a dependency audit, and a secret scan on every push and pull request to `main`. See [`docs/github-actions-ci.md`](docs/github-actions-ci.md) for details and notes on the `TEST_DATABASE_URL` secret.

## Security

See [`SECURITY.md`](SECURITY.md) for the vulnerability reporting policy and supported versions.

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) for the documented threat model.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, testing, branch/PR expectations, and coding conventions.

## License

MIT — see [`LICENSE`](LICENSE).

## Limitations

- Docker / Docker Compose: `docker-compose.yml` is provided for local database setup but has not been executed in this environment (Docker not available).
- PostgreSQL: not available locally in this build environment; a real PostgreSQL connection string is required to run the API.
- Playwright E2E tests are written and CI-configured but require browser binaries to run.
- Repository topics are not set automatically; add them manually under **Settings → General → Topics**. Suggested: `application-security`, `vulnerability-management`, `findings-tracking`, `typescript`, `express`, `react`, `postgresql`, `security-tools`.
