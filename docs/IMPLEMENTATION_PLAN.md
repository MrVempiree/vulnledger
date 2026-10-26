# VulnLedger — Implementation Plan

**Product:** VulnLedger — self-hostable vulnerability findings management platform
**Maintainer:** Lavish Gangwar / MrVempiree
**Version target:** 1.0.0 (MVP)
**Status:** Phase 0 — in progress

---

## 0. Architecture decisions (fixed by spec)

| Decision | Value | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces | Spec requirement; keeps api/web/contracts versioned together |
| API | Node.js + Express + TypeScript | Simple, well-understood, no heavy framework |
| Frontend | React + TypeScript + Vite | Spec requirement; lightweight dev server |
| Database | PostgreSQL 16 | Spec requirement; relational integrity for findings |
| ORM / migrations | Drizzle ORM + drizzle-kit | Type-safe, migration-focused, PostgreSQL-native |
| Validation | Zod | Runtime schema validation shared with contracts |
| Password hashing | argon2 (argon2id) | Spec requirement; memory-hard KDF |
| Sessions | server-side, PostgreSQL store (connect-pg-simple) | Spec requirement; no JWT stateless sessions |
| Session cookie | HttpOnly, SameSite=Lax, Secure in prod | Spec requirement |
| CSRF | csurf double-submit cookie | Spec requirement for state-changing cookie requests |
| Rate limiting | express-rate-limit on login / high-cost routes | Spec requirement |
| Tests | Vitest (unit), Supertest (HTTP integration), Playwright (E2E, if supported) | Spec requirement |
| Lint/format | ESLint + Prettier | Spec requirement |
| CI | GitHub Actions | Spec requirement |

### Environment blockers (recorded honestly)

- **pnpm**: installed globally (v12.15.0) via `npm install -g --allow-scripts=pnpm`. Not pre-installed in this environment.
- **Docker / Docker Compose**: not installed. `docker-compose.yml` is provided but cannot be executed locally.
- **PostgreSQL server**: not installed/running locally. `DATABASE_URL` must point to an externally provisioned PostgreSQL for integration tests and runtime. No local Postgres verification is possible here.
- **Playwright browsers**: unlikely to be installed; E2E test will be written and configured for CI, but documented as not runnable in this environment unless browsers are provisioned.

All code is written to run once pnpm + PostgreSQL are available. Unit tests that do not require a database will be executed where possible.

---

## 1. Directory structure

```
vulnledger/
  apps/
    api/          Express + TypeScript API (src/, tests/)
    web/          React + TypeScript + Vite UI (src/)
  packages/
    contracts/    Shared Zod schemas / TypeScript types
  db/             Drizzle schema + migrations
  docs/           IMPLEMENTATION_PLAN.md, THREAT_MODEL.md, SECURITY_DESIGN.md,
                  INCIDENT_RESPONSE.md, import-format.md
  fixtures/       Example JSON import fixtures
  scripts/        admin:create CLI
  .github/
    workflows/    CI
    ISSUE_TEMPLATE/
    PULL_REQUEST_TEMPLATE.md
  docker-compose.yml
  pnpm-workspace.yaml
  package.json
  README.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  SECURITY.md
  LICENSE
  .env.example
```

---

## 2. Phase gates

| Phase | Scope | Gate criteria |
|---|---|---|
| **0** | Inspect, scaffold, plan, threat-model outline | Clean structure, no destructive changes, install/test commands documented |
| **1** | DB schema/migrations, first-admin CLI, Argon2id, sessions, CSRF, rate limiting, roles, membership, authorization middleware | Migrations run from clean DB; auth + project-isolation tests pass; no default credentials |
| **2** | Project management, findings CRUD, status transitions, audit events, filter/sort/paginate | User can log in → access project → create/edit finding → persisted; unauthorized access tests pass |
| **3** | JSON import preview/validation/transactional commit, deterministic dedup, safe CSV/JSON exports | All import/export acceptance tests pass incl. idempotence, unauthorized access, CSV formula injection |
| **4** | Real API-connected UI, empty/error/loading states, responsiveness, a11y basics, demo fixtures, docker-compose, one browser E2E flow | Fresh-checkout setup works; README commands match scripts |
| **5** | Format/lint/typecheck/unit+integration/E2E where supported, production build, dep audit, secret scan, final diff review | No concealed critical blocker; limitations and exact results recorded |

---

## 3. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PostgreSQL unavailable locally | Certain | High | Write DB-backed code against `DATABASE_URL`; unit-test logic without DB; document integration tests require Postgres |
| Docker unavailable locally | Certain | Medium | `docker-compose.yml` provided, unverified locally; manual setup instructions in README |
| Playwright unavailable | Likely | Medium | E2E test written + CI-configured; documented as not runnable without browsers |
| argon2 native build fails | Possible | Medium | Document fallback path; pin compatible version |
| Session/CSRF misconfiguration | Medium | High | Fail closed when secrets missing; unit-test CSRF rejection and cookie flags |

---

## 4. Phase 0 status

- [x] pnpm installed (v12.15.0)
- [x] Directory scaffold created (apps/api, apps/web, packages/contracts, db, docs, fixtures, scripts, .github)
- [x] Root package.json, pnpm-workspace.yaml, docker-compose.yml, .env.example, .gitignore
- [ ] Install dependencies (pnpm install) — blocked until PostgreSQL available for api devDeps that may need native builds
- [ ] Run clean structure check
