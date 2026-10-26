/**
 * @fileoverview Finding routes.
 *
 * CRUD + validated status transitions + filtering/sorting/pagination + audit
 * events. Every operation verifies project membership server-side.
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { findings, memberships, projects, users, auditEvents } from "../schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import { findingInsertSchema, FINDING_STATUS_TRANSITIONS } from "@vulnledger/contracts";
import { validateBody } from "../lib/validation.js";
import { and, eq, sql, desc, asc, ilike, count } from "drizzle-orm";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ALLOWED_SORT_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "severity",
  "status",
  "title",
  "firstSeen",
]);

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function findingRoutes(router: Router): void {
  // List findings for a project (member+).
  router.get("/:projectId", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const params = z.object({ projectId: z.string().uuid() }).parse(req.params);
    const { page, pageSize, offset } = parsePagination(req.query);

    const isAdmin = user.role === "admin";
    const membershipOk = isAdmin
      ? undefined
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${findings.projectId} AND ${memberships.userId} = ${user.userId})`;

    // Verify project access first.
    const projectAccessOk = isAdmin
      ? sql`true`
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${params.projectId} AND ${memberships.userId} = ${user.userId})`;

    const [projectCheck] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, params.projectId), projectAccessOk))
      .limit(1);
    if (!projectCheck) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const whereClauses = [eq(findings.projectId, params.projectId)];
    if (membershipOk) whereClauses.push(membershipOk);

    // Filters
    const sev = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const src = typeof req.query.source === "string" ? req.query.source : undefined;
    const assigneeId = typeof req.query.assigneeId === "string" ? req.query.assigneeId : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    if (sev) whereClauses.push(eq(findings.severity, sev as any));
    if (status) whereClauses.push(eq(findings.status, status as any));
    if (src) whereClauses.push(eq(findings.source, src));
    if (assigneeId) whereClauses.push(eq(findings.assigneeId, assigneeId));
    if (search) {
      whereClauses.push(sql`${findings.title} ILIKE ${`%${search}%`}`);
    }

    // Sort
    const sortBy = ALLOWED_SORT_COLUMNS.has(String(req.query.sortBy))
      ? String(req.query.sortBy)
      : "createdAt";
    const sortDir = String(req.query.sortDir) === "asc" ? asc : desc;
    const sortColumn =
      sortBy === "createdAt" ? findings.createdAt :
      sortBy === "updatedAt" ? findings.updatedAt :
      sortBy === "severity" ? findings.severity :
      sortBy === "status" ? findings.status :
      sortBy === "title" ? findings.title :
      findings.firstSeen;

    const results = await db
      .select({
        id: findings.id,
        projectId: findings.projectId,
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
      .where(and(...whereClauses))
      .orderBy(sortDir(sortColumn))
      .limit(pageSize)
      .offset(offset);

    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(findings)
      .where(and(...whereClauses));

    res.json({
      findings: results,
      pagination: {
        page,
        pageSize,
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / pageSize),
      },
    });
  });

  // Get a single finding.
  router.get("/:projectId/:findingId", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const params = z
      .object({ projectId: z.string().uuid(), findingId: z.string().uuid() })
      .parse(req.params);

    const isAdmin = user.role === "admin";
    const accessOk = isAdmin
      ? sql`true`
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${findings.projectId} AND ${memberships.userId} = ${user.userId})`;

    const [finding] = await db
      .select({
        id: findings.id,
        projectId: findings.projectId,
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
      .where(
        and(
          eq(findings.id, params.findingId),
          eq(findings.projectId, params.projectId),
          accessOk,
        ),
      )
      .limit(1);

    if (!finding) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Audit timeline.
    const events = await db
      .select({
        id: auditEvents.id,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        eventType: auditEvents.eventType,
        summary: auditEvents.summary,
        createdAt: auditEvents.createdAt,
        actorId: auditEvents.actorId,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "finding"),
          eq(auditEvents.entityId, params.findingId),
        ),
      )
      .orderBy(desc(auditEvents.createdAt));

    res.json({ finding, auditEvents: events });
  });

  // Create a finding.
  router.post("/", requireAuth, validateBody(findingInsertSchema), async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const input = req.body as z.infer<typeof findingInsertSchema>;

    // Verify caller is a member of the target project.
    const isAdmin = user.role === "admin";
    const projectAccess = isAdmin
      ? sql`true`
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${input.projectId} AND ${memberships.userId} = ${user.userId})`;
    const [projectCheck] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), projectAccess))
      .limit(1);
    if (!projectCheck) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const nowDate = new Date();
    const [created] = await db.insert(findings).values({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      source: input.source,
      ruleId: input.ruleId,
      fingerprint: input.fingerprint,
      component: input.component,
      severity: input.severity,
      confidence: input.confidence,
      status: input.status ?? "new",
      cwe: input.cwe,
      cve: input.cve,
      evidence: input.evidence,
      remediationNotes: input.remediationNotes,
      assigneeId: input.assigneeId,
      firstSeen: nowDate,
      lastSeen: nowDate,
      createdBy: user.userId,
    } as any).returning();

    await db.insert(auditEvents).values({
      projectId: input.projectId,
      actorId: user.userId,
      entityType: "finding",
      entityId: created.id,
      eventType: "finding.created",
      summary: `Created finding "${created.title}"`,
    });

    res.status(201).json({ finding: created });
  });

  // Update a finding (validated status transitions, assignee checks).
  router.patch(
    "/:projectId/:findingId",
    requireAuth,
    async (req, res) => {
      const user = getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const params = z
        .object({ projectId: z.string().uuid(), findingId: z.string().uuid() })
        .parse(req.params);

      const isAdmin = user.role === "admin";
      const accessOk = isAdmin
        ? sql`true`
        : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${findings.projectId} AND ${memberships.userId} = ${user.userId})`;

      const [existing] = await db
        .select()
        .from(findings)
        .where(
          and(
            eq(findings.id, params.findingId),
            eq(findings.projectId, params.projectId),
            accessOk,
          ),
        )
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const updateSchema = z.object({
        title: z.string().min(1).max(1000).optional(),
        description: z.string().max(10000).optional(),
        severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
        confidence: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["new", "triaged", "in_progress", "resolved", "accepted_risk", "reopened"]).optional(),
        cwe: z.string().max(20).optional().nullable(),
        cve: z.string().max(50).optional().nullable(),
        component: z.string().max(500).optional(),
        evidence: z.string().max(5000).optional(),
        remediationNotes: z.string().max(10000).optional(),
        assigneeId: z.string().uuid().optional().nullable(),
      });
      const parse = updateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: "validation_failed", details: parse.error.errors });
        return;
      }
      const updates = parse.data;

      // Validate status transition.
      if (updates.status && updates.status !== existing.status) {
        const allowed = FINDING_STATUS_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(updates.status)) {
          res.status(400).json({ error: "invalid_status_transition" });
          return;
        }
      }

      // Assignee must belong to the project (if set).
      if (updates.assigneeId !== undefined && updates.assigneeId !== null) {
        const [member] = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.projectId, params.projectId),
              eq(memberships.userId, updates.assigneeId),
            ),
          )
          .limit(1);
        if (!member) {
          res.status(400).json({ error: "assignee_not_member" });
          return;
        }
      }

      const now = new Date().toISOString();
      const nowDate = new Date();
      const [updated] = await db
        .update(findings)
        .set({
          ...updates,
          updatedAt: nowDate,
          ...(updates.status === "resolved" && !existing.resolvedAt
            ? { resolvedAt: nowDate }
            : {}),
        })
        .where(eq(findings.id, params.findingId))
        .returning();

      const changeSummary = Object.keys(updates)
        .map((k) => k)
        .join(", ") || "metadata";
      await db.insert(auditEvents).values({
        projectId: params.projectId,
        actorId: user.userId,
        entityType: "finding",
        entityId: params.findingId,
        eventType: "finding.updated",
        summary: `Updated finding: ${changeSummary}`,
      });

      res.json({ finding: updated });
    },
  );

  // Delete a finding (admin only).
  router.delete("/:projectId/:findingId", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const params = z
      .object({ projectId: z.string().uuid(), findingId: z.string().uuid() })
      .parse(req.params);

    const [deleted] = await db
      .delete(findings)
      .where(
        and(eq(findings.id, params.findingId), eq(findings.projectId, params.projectId)),
      )
      .returning({ id: findings.id });

    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    await db.insert(auditEvents).values({
      projectId: params.projectId,
      actorId: user.userId,
      entityType: "finding",
      entityId: params.findingId,
      eventType: "finding.deleted",
      summary: "Deleted finding",
    });

    res.json({ ok: true });
  });
}
