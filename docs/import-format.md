# VulnLedger — JSON import format

**Version:** 1.0.0 MVP

## Overview

Version 1 accepts JSON-only imports. The file must be a single JSON object with a `source` string and a `findings` array. Imports are previewed before commit, validated field-by-field, and applied transactionally.

## Format

```json
{
  "source": "Example Scanner v2",
  "findings": [
    {
      "title": "Reflected XSS in search endpoint",
      "description": "User input is reflected unescaped in the search results page.",
      "source": "Example Scanner v2",
      "ruleId": "XSS-001",
      "fingerprint": "scan-12345-abcde",
      "component": "frontend/src/search.ts",
      "severity": "high",
      "confidence": "high",
      "status": "new",
      "cwe": "CWE-79",
      "cve": "",
      "evidence": "<request>GET /search?q=<script>...</script>",
      "remediationNotes": "Escape output and set a strict Content-Security-Policy.",
      "assigneeId": null
    }
  ]
}
```

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `source` | string (1–200) | Yes | Tool/scanner name; used for dedup grouping |
| `findings[].title` | string (1–1000) | Yes | Human-readable finding title |
| `findings[].description` | string (max 10000) | No | Defaults to `""` |
| `findings[].source` | string (1–200) | No | Defaults to the top-level `source` |
| `findings[].ruleId` | string (max 200) | No | Defaults to `""` |
| `findings[].fingerprint` | string (max 200) \| null | No | External fingerprint for dedup |
| `findings[].component` | string (max 500) | No | Defaults to `""`; affected resource label |
| `findings[].severity` | `info\|low\|medium\|high\|critical` | Yes | |
| `findings[].confidence` | `low\|medium\|high` | Yes | |
| `findings[].status` | `new\|triaged\|in_progress\|resolved\|accepted_risk\|reopened` | No | Defaults to `new` |
| `findings[].cwe` | string (max 20) \| null | No | Do not invent; supply only if sourced |
| `findings[].cve` | string (max 50) \| null | No | Do not invent; supply only if sourced |
| `findings[].evidence` | string (max 5000) | No | Defaults to `""` |
| `findings[].remediationNotes` | string (max 10000) | No | Defaults to `""` |
| `findings[].assigneeId` | UUID \| null | No | Must be a project member |

## Limits

- Max payload: 2 MiB (configurable via `IMPORT_MAX_SIZE_MIB`)
- Max records: 5,000 (configurable via `IMPORT_MAX_RECORDS`)

## Deduplication strategy

A finding is considered a duplicate when **all** of the following match an existing record:

- `projectId` (the import target)
- `source`
- `ruleId`
- `fingerprint` (or a derived key when absent)
- `component`

When `fingerprint` is absent, a stable key is derived from normalized `source`, `ruleId`, `projectId`, and `component`.

**Titles alone never trigger dedup.** Two findings with identical titles but different components/rules are treated as distinct.

Re-importing the same fixture is idempotent: already-imported findings are rejected as duplicates, not re-created.

## Workflow

1. `POST /import/:projectId/preview` — validate, perform dry-run, return accepted/rejected counts and per-item details. No writes occur.
2. `POST /import/:projectId/confirm` — transactional commit of accepted findings. Failsafe: a failed batch rolls back entirely.

## Example fixture

See `fixtures/example-import.json` for a complete, valid sample file.
