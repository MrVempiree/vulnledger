/**
 * @fileoverview Authentication tests.
 *
 * These tests require a running PostgreSQL instance configured via
 * DATABASE_URL. They assert security-critical authentication behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { type AddressInfo } from "net";
import Supertest, { type SuperAgentTest } from "supertest";

import { db } from "../src/db.js";
import { users } from "../src/schema.js";
import { hashPassword } from "../src/auth.js";
import { eq } from "drizzle-orm";

let server: ReturnType<typeof createServer>;
let request: Supertest.SuperTest<Supertest.Test>;

const TEST_EMAIL = "sec-test@example.com";
const TEST_PASSWORD = "Str0ng!Passw0rd";

beforeAll(async () => {
  const app = (await import("../src/index.js")).default;
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  request = Supertest(`http://localhost:${addr.port}`);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(resolve));
});

beforeEach(async () => {
  // Ensure a clean test user exists.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TEST_EMAIL))
    .limit(1);
  if (!existing) {
    await db.insert(users).values({
      email: TEST_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "member",
      disabled: false,
    });
  } else {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(TEST_PASSWORD), disabled: false })
      .where(eq(users.id, existing.id));
  }
});

describe("Authentication", () => {
  it("rejects invalid password with generic message (no account enumeration)", async () => {
    const res = await request.post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
    // Body should not reveal whether the account exists.
    expect(res.body).not.toHaveProperty("user");
    expect(res.body).not.toHaveProperty("account");
  });

  it("rejects missing account with the same generic message", async () => {
    const res = await request.post("/api/auth/login").send({
      email: "nonexistent@example.com",
      password: "anything",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("logs in successfully with valid credentials", async () => {
    const res = await request.post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it("returns 401 for unauthenticated access to protected routes", async () => {
    const res = await request.get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("session endpoint returns current user after login", async () => {
    await request.post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const res = await request.get("/api/auth/session");
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it("logout destroys the session", async () => {
    const agent = Supertest.agent(`http://localhost:${(server.address() as AddressInfo).port}`);
    await agent.post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const sessionRes = await agent.get("/api/auth/session");
    expect(sessionRes.status).toBe(200);

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    const afterRes = await agent.get("/api/auth/session");
    expect(afterRes.status).toBe(401);
  });
});

describe("Login rate limiting", () => {
  it("rate-limits repeated failed login attempts", async () => {
    // 20 failed attempts should trigger rate limiting.
    let lastStatus: number | null = null;
    for (let i = 0; i < 21; i++) {
      const res = await request.post("/api/auth/login").send({
        email: TEST_EMAIL,
        password: "wrong",
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
