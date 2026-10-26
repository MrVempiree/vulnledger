/**
 * @fileoverview Export routes.
 *
 * GET /api/export/:projectId - JSON and CSV exports, authorization-aware,
 * sanitized, bounded.
 *
 * CSV formula injection: any cell whose value begins with a spreadsheet
 * formula character (`=`, `+`, `-`, `@`) or a control character is prefixed
 * with a tab character (`\t`), which neutralizes formula interpretation while
 * preserving the visible text. Delimiters, quotes, and newlines are escaped
 * per RFC 4180.
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { findings, memberships, projects } from "../schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import { and, eq, sql } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 100;
const MAX_EXPORT_PAGE_SIZE = 1000;

const FINDING_FIELDS = [
  "id",
  "title",
  "description",
  "source",
  "ruleId",
  "fingerprint",
  "component",
  "severity",
  "confidence",
  "status",
  "cwe",
  "cve",
  "evidence",
  "remediationNotes",
  "assigneeId",
  "firstSeen",
  "lastSeen",
  "createdAt",
  "updatedAt",
  "createdBy",
  "resolvedAt",
] as const;

function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutralize formula injection: leading formula or control characters.
  if (/^[=+\-@\t\r\n\v\f]/.test(text)) {
    return `\t${text}`;
  }
  return text;
}

function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const header = FINDING_FIELDS.join(",");
  const lines = [header];
  for (const row of rows) {
    const cells = FINDING_FIELDS.map((f) => escapeCsvCell(sanitizeCell(row[f])));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export function exportRoutes(router: Router): void {
  router.get("/:projectId", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const params = z.object({ projectId: z.string().uuid() }).parse(req.params);

    const isAdmin = user.role === "admin";
    const accessOk = isAdmin
      ? sql`true`
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${findings.projectId} AND ${memberships.userId} = ${user.userId})`;

    const [projectAccess] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, params.projectId),
          isAdmin
            ? sql`true`
            : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${projects.id} AND ${memberships.userId} = ${user.userId})`,
        ),
      )
      .limit(1);
    if (!projectAccess) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const format = String(req.query.format || "json");
    const pageSize = Math.min(
      MAX_EXPORT_PAGE_SIZE,
      Math.max(1, parseInt(req.query.pageSize as string, 10) || DEFAULT_PAGE_SIZE),
    );
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        id: findings.id,
        title: findings.title,
        description: findings.description,
        source: findings.source,
        ruleId: findings.ruleId,
        fingerprint: findings.fingerprint,
        component: findings.component,
        severity: findings.severity,
        confidence: findings.confidence,
        status: findings.status,
        cwe: findings.cwe,
        cve: findings.cve,
        evidence: findings.evidence,
        remediationNotes: findings.remediationNotes,
        assigneeId: findings.assigneeId,
        firstSeen: findings.firstSeen,
        lastSeen: findings.lastSeen,
        createdAt: findings.createdAt,
        updatedAt: findings.updatedAt,
        createdBy: findings.createdBy,
        resolvedAt: findings.resolvedAt,
      })
      .from(findings)
      .where(eq(findings.projectId, params.projectId))
      .orderBy(findings.createdAt)
      .limit(pageSize)
      .offset(offset);

    const exportedAt = new Date().toISOString();

    if (format === "csv") {
      const csv = rowsToCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vulnledger-export-${params.projectId}.csv"`,
      );
      res.send(csv);
      return;
    }

    // JSON (default).
    res.json({
      exportedAt,
      projectId: params.projectId,
      format: "json",
      count: rows.length,
      page,
      pageSize,
      findings: rows,
    });
  });
}
