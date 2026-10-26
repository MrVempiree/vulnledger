/**
 * @fileoverview Request validation helper.
 *
 * Validates an Express request body against a Zod schema and returns either
 * the parsed data or a structured, field-level error response. Stack traces
 * are never returned to the client.
 */

import { type Request, type Response, type NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";

export interface ValidationErrorDetail {
  field: (string | number)[];
  message: string;
}

export interface ValidationErrorBody {
  error: "validation_failed";
  details: ValidationErrorDetail[];
}

/**
 * Middleware factory: validates `req.body` against `schema`. On failure,
 * responds 400 with field-level details and does not call next().
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details: ValidationErrorDetail[] = result.error.errors.map(
        (err) => ({
          field: err.path,
          message: err.message,
        }),
      );
      res.status(400).json({ error: "validation_failed", details });
      return;
    }
    req.body = result.data as unknown as Record<string, unknown>;
    next();
  };
}

/**
 * Parse + validate without Express (used by import preview and scripts).
 */
export function parseOrThrow<T extends ZodSchema>(
  schema: T,
  input: unknown,
): T["_output"] {
  return schema.parse(input);
}
