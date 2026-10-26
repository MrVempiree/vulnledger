/**
 * @fileoverview Audit event routes.
 *
 * GET /api/audit/:projectId - sanitized audit history for a project.
 * Caller must be a member of the project (admin included).
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { auditEvents, memberships, projects } from "../schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import { and, eq, sql, desc } from "drizzle-orm";

export function auditRoutes(router: Router): void {
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
      : sql`EXISTS (SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${projects.id} AND ${memberships.userId} = ${user.userId})`;

    const [projectAccess] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, params.projectId), accessOk))
      .limit(1);
    if (!projectAccess) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize as string, 10) || 25),
    );
    const offset = (page - 1) * pageSize;

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
      .where(eq(auditEvents.projectId, params.projectId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({ auditEvents: events, page, pageSize });
  });
}
