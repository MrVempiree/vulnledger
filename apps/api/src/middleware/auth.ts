/**
 * @fileoverview Authentication middleware.
 *
 * Loads the current user from the server-side session and attaches
 * `req.user` (id, email, role). Unauthenticated access to protected routes
 * is handled by the `requireAuth` wrapper which returns 401 with a generic
 * message that does not reveal account existence.
 */

import { type Request, type Response, type NextFunction } from "express";
import { type Session } from "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    email?: string;
    role?: string;
    regeneratedAt?: number;
  }
}

export interface AuthUser {
  userId: string;
  email: string;
  role: "admin" | "member";
}

export function getAuthUser(req: Request): AuthUser | null {
  const session = req.session as Session & {
    userId?: string;
    email?: string;
    role?: string;
  };
  if (!session.userId || !session.email || !session.role) {
    return null;
  }
  return {
    userId: session.userId,
    email: session.email,
    role: session.role as "admin" | "member",
  };
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  (req as Request & { user?: AuthUser }).user = user;
  next();
}

/**
 * Middleware that requires the caller to have the `admin` role at the
 * installation level.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  (req as Request & { user?: AuthUser }).user = user;
  next();
}
