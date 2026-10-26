/**
 * @fileoverview Project and authorization tests.
 *
 * Requires a PostgreSQL test database via DATABASE_URL.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { type AddressInfo } from "net";
import Supertest, { type SuperAgentTest } from "supertest";

import { db } from "../src/db.js";
import { users, projects, memberships } from "../src/schema.js";
import { hashPassword } from "../src/auth.js";
import { eq, and } from "drizzle-orm";

let server: ReturnType<typeof createServer>;
let request: Supertest.SuperTest<supertest.SuperTest.Test>;

const ADMIN_EMAIL = "admin-test@example.com";
const MEMBER_EMAIL = "member-test@example.com";
const TEST_PASSWORD = "Str0ng!Passw0rd";

let adminUserId: string;
let memberUserId: string;
let projectId: string;

async function loginAs(email: string, password: string) {
  const res = await request.post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return Supertest.agent(`http://localhost:${(server.address() as AddressInfo).port}`);
}

beforeAll(async () => {
  const app = (await import("../src/index.js")).default;
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  request = Supertest(`http://localhost:${(server.address() as AddressInfo).port}`);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(resolve));
});

beforeEach(async () => {
  // Create admin and member users.
  const [admin] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "admin",
      disabled: false,
    })
    .returning({ id: users.id });
  adminUserId = admin.id;

  const [member] = await db
    .insert(users)
    .values({
      email: MEMBER_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "member",
      disabled: false,
    })
    .returning({ id: users.id });
  memberUserId = member.id;

  // Admin creates a project and adds member.
  const [proj] = await db
    .insert(projects)
    .values({ name: "Test Project", description: "desc", creatorId: adminUserId })
    .returning({ id: projects.id });
  projectId = proj.id;

  await db.insert(memberships).values({
    projectId,
    userId: adminUserId,
    role: "admin",
  });
  await db.insert(memberships).values({
    projectId,
    userId: memberUserId,
    role: "member",
  });
});

describe("Project access control", () => {
  it("member can access their own project", async () => {
    const agent = await loginAs(MEMBER_EMAIL, TEST_PASSWORD);
    const res = await agent.get(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(projectId);
  });

  it("member cannot access another project they are not a member of", async () => {
    const agent = await loginAs(MEMBER_EMAIL, TEST_PASSWORD);
    // Create a second project the member is not part of.
    const [other] = await db
      .insert(projects)
      .values({ name: "Other Project", description: "desc", creatorId: adminUserId })
      .returning({ id: projects.id });
    const res = await agent.get(`/api/projects/${other.id}`);
    expect(res.status).toBe(404);
  });

  it("non-member cannot list members of a project", async () => {
    // Create a user who is not a member of any project.
    const [outsider] = await db
      .insert(users)
      .values({
        email: "outsider@example.com",
        passwordHash: await hashPassword(TEST_PASSWORD),
        role: "member",
        disabled: false,
      })
      .returning({ id: users.id });
    const agent = Supertest.agent(`http://localhost:${(server.address() as AddressInfo).port}`);
    await agent.post("/api/auth/login").send({
      email: "outsider@example.com",
      password: TEST_PASSWORD,
    });
    const res = await agent.get(`/api/projects/${projectId}/members`);
    expect(res.status).toBe(404);
  });

  it("admin can create a project and add membership", async () => {
    const agent = await loginAs(ADMIN_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/projects").send({
      name: "New Project",
      description: "new desc",
    });
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe("New Project");
  });

  it("member cannot create a project (admin only)", async () => {
    const agent = await loginAs(MEMBER_EMAIL, TEST_PASSWORD);
    const res = await agent.post("/api/projects").send({
      name: "Member Project",
      description: "desc",
    });
    expect(res.status).toBe(403);
  });
});
