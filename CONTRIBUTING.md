# Contributing to VulnLedger

Thank you for your interest. VulnLedger is a security-focused project: changes to authentication, authorization, or the import/export path can directly affect data safety, so every contribution is reviewed carefully.

## How to contribute

1. Fork the repository and create a branch from `main`.
2. Run the setup steps in [`README.md`](README.md).
3. Add or update tests for any behavior change — especially authorization invariants, import dedup, and CSV formula injection.
4. Run the quality gates:
   - `pnpm --filter api lint`
   - `pnpm --filter api typecheck`
   - `pnpm --filter api test`
   - `pnpm --filter web typecheck`
   - `pnpm --filter web build`
5. Open a pull request describing the change, the acceptance criteria it satisfies, and the test strategy used.

## Coding conventions

- TypeScript strict mode; no `any` where a type can be inferred.
- Zod schemas for all API request bodies and import payloads (single source of truth in `packages/contracts`).
- Server-side authorization for every read/write — frontend hiding is not authorization.
- No secrets, passwords, or raw evidence in logs or error responses.
- Drizzle migrations are additive; never edit an applied migration.

## Security

Do not disclose potential security vulnerabilities in public issues or pull requests. See [`SECURITY.md`](SECURITY.md).

## License

MIT — contributions are licensed under the same terms.
