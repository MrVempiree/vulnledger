/**
 * @fileoverview Drizzle Kit configuration.
 *
 * Run migrations with: pnpm exec drizzle-kit migrate
 * Generate a new migration: pnpm exec drizzle-kit generate
 */

import type { Config } from "drizzle-kit";

export default {
  schema: "./apps/api/src/schema.ts",
  out: "./db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
