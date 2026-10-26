# GitHub Actions CI workflow

This file contains the exact content of `.github/workflows/ci.yml`.

**Why is it not already in `.github/workflows/`?**
The GitHub App used to publish this repository does not have the `workflows`
permission scope. GitHub refuses to create or update files under
`.github/workflows/` through the API without that scope, so the workflow could
not be committed automatically. The repository source is otherwise complete.

**To enable CI:** copy this file to `.github/workflows/ci.yml` and push it.

```bash
cp docs/github-actions-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow"
git push
```

Once pushed, CI runs on every push and pull request targeting `main`.

---

## Workflow content

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 12

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Format check
        run: pnpm exec prettier --check "apps/**/*.{ts,tsx}" "packages/**/*.ts"

      - name: Lint (API)
        run: pnpm --filter api lint

      - name: Typecheck
        run: pnpm run typecheck

      - name: Unit + integration tests (API)
        run: pnpm --filter api test
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          SESSION_SECRET: test-secret-do-not-use-in-production

      - name: Production build
        run: pnpm run build

      - name: Dependency audit
        run: pnpm audit --production || true

      - name: Secret scan
        run: |
          if grep -R "sk_live\|sk_test\|AKIA\|ghp_" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" apps packages db docs; then
            echo "::error::Potential secret detected"
            exit 1
          fi
```

### Notes on the workflow

- `permissions: contents: read` — least privilege; the workflow does not need
  write access to the repository.
- The `TEST_DATABASE_URL` secret is only required for the database-backed
  integration tests. Without it, that step fails; set the secret in
  **Settings → Secrets and variables → Actions** to enable the full suite.
- `pnpm audit --production || true` is non-blocking by design so that an
  advisory in a transitive dependency does not block unrelated pull requests.
  Review advisories in the Security tab.
- The secret-scan step greps for common credential prefixes. It is a safety
  net, not a replacement for review.
