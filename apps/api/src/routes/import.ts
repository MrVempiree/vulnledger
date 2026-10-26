/**
 * @fileoverview JSON import routes.
 *
 * POST /api/import/:projectId/preview   - validate, no writes, return counts
 * POST /api/import/:projectId/confirm   - transactional commit of a previewed import
 *
 * Dedup strategy (documented): a finding is considered a duplicate when
 * projectId + source + ruleId + fingerprint + component all match. When
 * fingerprint is absent, a stable key is derived from normalized source,
 * ruleId, project, and component. Titles alone never trigger dedup.
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  findings,
  projects,
  memberships,
  importBatches,
  auditEvents,
} from "../schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import { importPayloadSchema } from "@vulnledger/contracts";
import { and, eq, sql } from "drizzle-orm";

const MAX_RECORDS = parseInt(process.env.IMPORT_MAX_RECORDS || "5000", 10);
const MAX_SIZE_MIB = parseInt(process.env.IMPORT_MAX_SIZE_MIB || "2", 10);

function deriveFingerprint(
  source: string,
  ruleId: string,
  projectId: string,
  component: string,
): string {
  const input = [source, ruleId, projectId, component]
    .map((s) => s.trim().toLowerCase())
    .join("|");
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

export function importRoutes(router: Router): void {
  router.post(
    "/:projectId/preview",
    requireAuth,
    async (req, res) => {
      const user = getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const params = z.object({ projectId: z.string().uuid() }).parse(req.params);

      const raw = JSON.stringify(req.body);
      const sizeMib = Buffer.byteLength(raw, "utf8") / (1024 * 1024);
      if (sizeMib > MAX_SIZE_MIB) {
        res.status(413).json({ error: "import_too_large" });
        return;
      }

      const parse = importPayloadSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "validation_failed", details: parse.error.errors });
        return;
      }
      const { source, findings: incoming } = parse.data;

      if (incoming.length > MAX_RECORDS) {
        res.status(400).json({ error: "too_many_records" });
        return;
      }

      const isAdmin = user.role === "admin";
      const accessOk = isAdmin
        ? sql`true`
        : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${params.projectId} AND ${memberships.userId} = ${user.userId})`;
      const [projectCheck] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, params.projectId), accessOk))
        .limit(1);
      if (!projectCheck) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      let accepted = 0;
      let rejected = 0;
      const details: Array<{
        index: number;
        title: string;
        status: "accepted" | "rejected";
        reason?: string;
        duplicateOf?: string;
      }> = [];
      const seenKeys = new Set<string>();

      for (const [index, finding] of incoming.entries()) {
        const fingerprint =
          finding.fingerprint ||
          deriveFingerprint(source, finding.ruleId, params.projectId, finding.component);
        const dedupKey = `${params.projectId}:${source}:${finding.ruleId}:${fingerprint}:${finding.component}`;

        if (!finding.title || !finding.source || !finding.component) {
          rejected++;
          details.push({ index, title: finding.title || "", status: "rejected", reason: "missing_required_field" });
          continue;
        }

        if (seenKeys.has(dedupKey)) {
          rejected++;
          details.push({ index, title: finding.title, status: "rejected", reason: "duplicate_within_batch", duplicateOf: dedupKey });
          continue;
        }

        const [existing] = await db
          .select({ id: findings.id })
          .from(findings)
          .where(
            and(
              eq(findings.projectId, params.projectId),
              eq(findings.source, source),
              eq(findings.ruleId, finding.ruleId),
              eq(findings.component, finding.component),
              finding.fingerprint
                ? eq(findings.fingerprint, finding.fingerprint)
                : sql`${findings.fingerprint} IS NULL`,
            ),
          )
          .limit(1);

        if (existing) {
          rejected++;
          details.push({ index, title: finding.title, status: "rejected", reason: "duplicate_in_database", duplicateOf: existing.id });
          continue;
        }

        seenKeys.add(dedupKey);
        accepted++;
        details.push({ index, title: finding.title, status: "accepted" });
      }

      res.status(200).json({
        preview: {
          projectId: params.projectId,
          source,
          total: incoming.length,
          accepted,
          rejected,
          details,
        },
        canCommit: accepted > 0,
      });
    },
  );

  router.post(
    "/:projectId/confirm",
    requireAuth,
    async (req, res) => {
      const user = getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const params = z.object({ projectId: z.string().uuid() }).parse(req.params);

      const confirmSchema = z.object({
        source: z.string().min(1).max(200),
        findings: z.array(
          z.object({
            title: z.string().min(1).max(1000),
            description: z.string().max(10000).optional().default(""),
            source: z.string().min(1).max(200).optional(),
            ruleId: z.string().max(200).optional().default(""),
            fingerprint: z.string().max(200).optional().nullable(),
            component: z.string().max(500).optional().default(""),
            severity: z.enum(["info", "low", "medium", "high", "critical"]),
            confidence: z.enum(["low", "medium", "high"]),
            status: z.enum(["new", "triaged", "in_progress", "resolved", "accepted_risk", "reopened"]).optional().default("new"),
            cwe: z.string().max(20).optional().nullable(),
            cve: z.string().max(50).optional().nullable(),
            evidence: z.string().max(5000).optional().default(""),
            remediationNotes: z.string().max(10000).optional().default(""),
            assigneeId: z.string().uuid().optional().nullable(),
          }),
        ),
      });
      const parse = confirmSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "validation_failed", details: parse.error.errors });
        return;
      }
      const { source, findings: incoming } = parse.data;

      const now = new Date();

      const result = await db.transaction(async (tx) => {
        const isAdmin = user.role === "admin";
        const accessOk = isAdmin
          ? sql`true`
          : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${params.projectId} AND ${memberships.userId} = ${user.userId})`;
        const [projectCheck] = await tx
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, params.projectId), accessOk))
          .limit(1);
        if (!projectCheck) {
          throw new Error("not_found");
        }

        const seenKeys = new Set<string>();
        let accepted = 0;
        let rejected = 0;

        for (const finding of incoming) {
          const fingerprint =
            finding.fingerprint ||
            deriveFingerprint(source, finding.ruleId, params.projectId, finding.component);
          const dedupKey = `${params.projectId}:${source}:${finding.ruleId}:${fingerprint}:${finding.component}`;

          if (seenKeys.has(dedupKey)) {
            rejected++;
            continue;
          }

          const [existing] = await tx
            .select({ id: findings.id })
            .from(findings)
            .where(
              and(
                eq(findings.projectId, params.projectId),
                eq(findings.source, source),
                eq(findings.ruleId, finding.ruleId),
                eq(findings.component, finding.component),
                finding.fingerprint
                  ? eq(findings.fingerprint, finding.fingerprint)
                  : sql`${findings.fingerprint} IS NULL`,
              ),
            )
            .limit(1);

          if (existing) {
            rejected++;
            continue;
          }

          seenKeys.add(dedupKey);
          accepted++;

          await tx.insert(findings).values({
            projectId: params.projectId,
            title: finding.title,
            description: finding.description,
            source: finding.source ?? source,
            ruleId: finding.ruleId,
            fingerprint,
            component: finding.component,
            severity: finding.severity,
            confidence: finding.confidence,
            status: finding.status,
            cwe: finding.cwe,
            cve: finding.cve,
            evidence: finding.evidence,
            remediationNotes: finding.remediationNotes,
            assigneeId: finding.assigneeId,
            firstSeen: now,
            lastSeen: now,
            createdBy: user.userId,
          } as any);
        }

        await tx.insert(importBatches).values({
          projectId: params.projectId,
          actorId: user.userId,
          source,
          acceptedCount: accepted,
          rejectedCount: rejected,
        });

        await tx.insert(auditEvents).values({
          projectId: params.projectId,
          actorId: user.userId,
          entityType: "import_batch",
          entityId: undefined,
          eventType: "import.committed",
          summary: `Imported ${accepted} finding(s), ${rejected} rejected from ${source}`,
        });

        return { accepted, rejected };
      });

      res.status(201).json(result);
    },
  );
}
