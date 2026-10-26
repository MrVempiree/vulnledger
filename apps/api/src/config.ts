/**
 * @fileoverview Centralized configuration with fail-closed validation.
 *
 * Required production secrets are validated here. The application refuses to
 * start when a security-critical value is missing rather than degrading
 * silently.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required configuration is missing: ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: (process.env.NODE_ENV || "development") as
    | "development"
    | "production"
    | "test",
  port: parseInt(process.env.PORT || "3000", 10),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "vulnledger_session",
  sessionCookieSecure:
    process.env.SESSION_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  sessionCookieSameSite: ("lax" as const),
  csrfSecret: process.env.CSRF_SECRET || required("SESSION_SECRET"),
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  importMaxSizeMib: parseInt(process.env.IMPORT_MAX_SIZE_MIB || "2", 10),
  importMaxRecords: parseInt(process.env.IMPORT_MAX_RECORDS || "5000", 10),
  trustProxy: process.env.TRUST_PROXY === "true",
} as const;

export const SESSION_COOKIE_SECURE = config.sessionCookieSecure;
