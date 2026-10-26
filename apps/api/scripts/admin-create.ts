/**
 * @fileoverview First-administrator bootstrap CLI.
 *
 * Usage: pnpm --filter api admin:create
 *
 * Prompts for email and password, hashes the password with argon2id, and
 * creates the first administrator user. There is no built-in/default password.
 * Requires DATABASE_URL and SESSION_SECRET in .env.
 */

import "dotenv/config.js";
import { createHash } from "crypto";
import readline from "readline";
import { hashPassword } from "../src/auth.js";
import { db } from "../src/db.js";
import { users } from "../src/schema.js";
import { eq } from "drizzle-orm";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL is not set in .env");
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    console.error("FATAL: SESSION_SECRET is not set in .env");
    process.exit(1);
  }

  const email = (await question("Admin email: ")).trim().toLowerCase();
  if (!email) {
    console.error("Email is required.");
    process.exit(1);
  }

  const password = await question("Admin password (min 12 chars): ");
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    email,
    passwordHash,
    role: "admin",
    disabled: false,
  });

  console.log(`Administrator created: ${email}`);
  console.log("Store this password securely. It cannot be recovered.");
  rl.close();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
