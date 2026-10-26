/**
 * @fileoverview VulnLedger API entry point.
 *
 * Creates the Express application, applies security middleware, mounts
 * versioned routes, and starts the HTTP server when DATABASE_URL is present.
 * Fails closed if required production secrets are missing.
 */

import "dotenv/config.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { pool } from "./db.js";
import { SESSION_COOKIE_SECURE } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { findingRoutes } from "./routes/findings.js";
import { importRoutes } from "./routes/import.js";
import { exportRoutes } from "./routes/export.js";
import { auditRoutes } from "./routes/audit.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";

const PGSession = connectPgSimple(session);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy only when behind a known reverse proxy in production.
app.set("trust proxy", process.env.TRUST_PROXY === "true");

// Security headers (helmet). Content-Security-Policy is intentionally
// permissive here because the frontend is served separately (Vite dev /
// or a static host); tighten further if the API ever serves HTML directly.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));

// CORS to explicit trusted origins only (no wildcard).
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "x-csrf-token"],
  }),
);

// Body parsing with a bounded limit to mitigate oversized requests.
app.use(express.json({ limit: "2mb" }));

// Server-side sessions stored in PostgreSQL.
app.use(
  session({
    store: new PGSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    name: process.env.SESSION_COOKIE_NAME || "vulnledger_session",
    secret: process.env.SESSION_SECRET || "dev-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: SESSION_COOKIE_SECURE,
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
    },
    rolling: true,
  }),
);

// Fail closed when session secret is missing.
if (!process.env.SESSION_SECRET) {
  console.error(
    "[api] FATAL: SESSION_SECRET is not set. Refusing to start without a session secret.",
  );
  process.exit(1);
}

// CSRF protection for state-changing requests (after session so cookies work).
import { csrfProtection } from "./middleware/csrf.js";
app.use(csrfProtection);

// Rate limiting.
import { loginRateLimit, writeRateLimit } from "./middleware/rate-limit.js";
app.use("/api/auth/login", loginRateLimit);
app.use("/api/", writeRateLimit);

// Routes.
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/findings", findingRoutes);
app.use("/api/import", importRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/audit", auditRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});

export default server;
