/**
 * @fileoverview CSRF protection middleware.
 *
 * Double-submit cookie pattern: the client reads `X-CSRF-TOKEN` from a
 * cookie and sends it back in the `X-CSRF-TOKEN` header on every
 * state-changing request. The middleware compares the two values using a
 * constant-time comparison and rejects mismatches with 403.
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 */

import { type Request, type Response, type NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.["csrf_token"];
  const headerToken = req.headers["x-csrf-token"];

  if (!cookieToken || !headerToken || typeof headerToken !== "string") {
    res.status(403).json({ error: "csrf_required" });
    return;
  }

  const cookieBytes = Buffer.from(cookieToken, "utf8");
  const headerBytes = Buffer.from(headerToken, "utf8");
  if (cookieBytes.length !== headerBytes.length) {
    res.status(403).json({ error: "csrf_required" });
    return;
  }
  if (!timingSafeEqual(cookieBytes, headerBytes)) {
    res.status(403).json({ error: "csrf_required" });
    return;
  }

  next();
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}
