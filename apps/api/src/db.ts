/**
 * @fileoverview Database client.
 *
 * Builds a Drizzle ORM client bound to a PostgreSQL connection. Reads
 * DATABASE_URL from the environment. Fails closed (throws) when DATABASE_URL
 * is missing so the application never starts without a configured database.
 */

import { Pool } from "pg";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Provide a PostgreSQL connection string in .env.",
  );
}

/**
 * Raw `pg` Pool used for the PostgreSQL session store (connect-pg-simple).
 * Kept separate from the Drizzle sql client because connect-pg-simple expects
 * a pg.Pool instance.
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,
});

pool.on("error", (err: Error) => {
  console.error("[db] unexpected postgres pool error", err.message);
});

/**
 * Drizzle database client over postgres.js. Exported for route handlers and
 * tests that need direct table access.
 */
export const sql = postgres(DATABASE_URL, { prepare: undefined });
export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
