/**
 * @fileoverview Authentication routes.
 *
 * POST /api/auth/login   - email + password; generic failure message
 * POST /api/auth/logout  - destroy server-side session
 * GET  /api/auth/session - current session user (read-only)
 *
 * Password verification failures and missing-account failures both return the
 * same generic message so the endpoint cannot be used to enumerate accounts.
 * Login is rate-limited (see index.ts).
 */

import { type Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { users } from "../schema.js";
import { verifyPassword, generateSessionId } from "../auth.js";
import { loginSchema } from "@vulnledger/contracts";
import { validateBody } from "../lib/validation.js";
import { requireAuth } from "../middleware/auth.js";
import { generateCsrfToken } from "../middleware/csrf.js";
import { eq } from "drizzle-orm";

export function authRoutes(router: Router): void {
  router.post(
    "/login",
    validateBody(loginSchema),
    async (req, res) => {
      const { email, password } = req.body as { email: string; password: string };

      const [user] = await db
        .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, role: users.role, disabled: users.disabled })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Generic failure: identical message and timing-ish behavior whether the
      // account exists, is disabled, or the password is wrong.
      if (!user || user.disabled) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      // Regenerate session to prevent session fixation.
      req.session.regenerate((err) => {
        if (err) {
          res.status(500).json({ error: "internal_server_error" });
          return;
        }
        (req.session as any).userId = user.id;
        (req.session as any).email = user.email;
        (req.session as any).role = user.role;
        (req.session as any).regeneratedAt = Date.now();

        // Issue CSRF token cookie after successful login.
        res.cookie("csrf_token", generateCsrfToken(), {
          httpOnly: false, // client JS needs to read it for the header
          sameSite: "lax",
          secure: process.env.SESSION_COOKIE_SECURE === "true",
          maxAge: 4 * 60 * 60 * 1000,
        });

        res.json({
          user: { id: user.id, email: user.email, role: user.role },
        });
      });
    },
  );

  router.post("/logout", requireAuth, (req, res) => {
    req.session.destroy((err: Error) => {
      if (err) {
        res.status(500).json({ error: "internal_server_error" });
        return;
      }
      res.clearCookie("csrf_token");
      res.clearCookie(process.env.SESSION_COOKIE_NAME || "vulnledger_session");
      res.json({ ok: true });
    });
  });

  router.get("/session", requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({ user: { id: user.userId, email: user.email, role: user.role } });
  });
}
