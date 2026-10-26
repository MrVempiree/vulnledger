/**
 * @fileoverview Rate-limiting middleware factory.
 *
 * Applies express-rate-limit with a generic message that does not reveal
 * whether an account exists or how many attempts remain.
 */

import rateLimit from "express-rate-limit";

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});

export const writeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 state-changing requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});
