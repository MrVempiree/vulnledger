/**
 * @fileoverview Project routes.
 *
 * Admins can create projects and manage membership; members see only projects
 * they belong to. Every route verifies authorization server-side.
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { projects, memberships, users } from "../schema.js";
import { requireAuth, requireAdmin, getAuthUser } from "../middleware/auth.js";
import { projectInsertSchema } from "@vulnledger/contracts";
import { validateBody } from "../lib/validation.js";
import { and, eq, sql } from "drizzle-orm";

export function projectRoutes(router: Router): void {
  // List projects visible to the caller.
  router.get("/", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }

    const isAdmin = user.role === "admin";
    let result;
    if (isAdmin) {
      result = await db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        creatorId: projects.creatorId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      }).from(projects);
    } else {
      result = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          creatorId: projects.creatorId,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .innerJoin(memberships, eq(memberships.projectId, projects.id))
        .where(eq(memberships.userId, user.userId));
    }
    res.json({ projects: result });
  });

  // Create a project (admin only).
  router.post("/", requireAdmin, validateBody(projectInsertSchema), async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { name, description } = req.body as { name: string; description?: string };

    const [created] = await db.insert(projects).values({
      name,
      description: description ?? "",
      creatorId: user.userId,
    }).returning();

    await db.insert(memberships).values({
      projectId: created.id,
      userId: user.userId,
      role: "admin",
    });

    res.status(201).json({ project: created });
  });

  // Get a project + membership (caller must be a member).
  router.get("/:projectId", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.params);

    const isAdmin = user.role === "admin";
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        creatorId: projects.creatorId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(
        isAdmin
          ? eq(projects.id, projectId)
          : sql`${projects.id} = ${projectId} AND EXISTS (
            SELECT 1 FROM ${memberships} WHERE ${memberships.projectId} = ${projects.id} AND ${memberships.userId} = ${user.userId}
          )`,
      )
      .limit(1);

    if (!project) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json({ project });
  });

  // List members of a project (member+ can read).
  router.get("/:projectId/members", requireAuth, async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.params);

    const isAdmin = user.role === "admin";
    const members = await db
      .select({
        id: memberships.id,
        projectId: memberships.projectId,
        userId: memberships.userId,
        role: memberships.role,
        createdAt: memberships.createdAt,
        email: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        isAdmin
          ? eq(memberships.projectId, projectId)
          : sql`${memberships.projectId} = ${projectId} AND ${memberships.userId} = ${user.userId}`,
      );

    res.json({ members });
  });

  // Add/update membership (admin only).
  router.post("/:projectId/members", requireAdmin, async (req, res) => {
    const schema = z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "member"]),
    });
    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "validation_failed", details: parse.error.errors });
      return;
    }
    const { userId, role } = parse.data;
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.params);

    // Verify target user exists.
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }

    const [existing] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.projectId, projectId), eq(memberships.userId, userId)))
      .limit(1);

    let membership;
    if (existing) {
      [membership] = await db.update(memberships)
        .set({ role })
        .where(and(eq(memberships.projectId, projectId), eq(memberships.userId, userId)))
        .returning();
    } else {
      [membership] = await db.insert(memberships).values({ projectId, userId, role }).returning();
    }

    res.json({ membership });
  });

  // Remove membership (admin only; cannot remove self as last admin).
  router.delete("/:projectId/members/:memberUserId", requireAdmin, async (req, res) => {
    const params = z.object({ projectId: z.string().uuid(), memberUserId: z.string().uuid() }).parse(req.params);
    const user = getAuthUser(req)!;

    if (params.memberUserId === user.userId) {
      // Prevent removing self if it would leave the project without any admin.
      const admins = await db
        .select({ count: sql`count(*)`.as("count") })
        .from(memberships)
        .where(and(eq(memberships.projectId, params.projectId), eq(memberships.role, "admin")));
      const count = Number(admins[0]?.count);
      if (count <= 1) {
        res.status(400).json({ error: "cannot_remove_last_admin" });
        return;
      }
    }

    await db.delete(memberships)
      .where(and(eq(memberships.projectId, params.projectId), eq(memberships.userId, params.memberUserId)));
    res.json({ ok: true });
  });
}
