/**
 * @fileoverview Error middleware.
 *
 * 404 handler and a centralized error handler that never leaks stack traces
 * or internal details to the client. Errors are logged server-side only.
 */

import { type Request, type Response, type NextFunction } from "express";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "not_found" });
}

export interface AppError extends Error {
  statusCode?: number;
  exposeStack?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;

  // Log server-side for diagnostics; never send internals to the client.
  console.error(
    `[api] error ${statusCode}: ${err.message}\n${err.stack || ""}`,
  );

  const isProduction = process.env.NODE_ENV === "production";
  const body: { error: string; message?: string; stack?: string } = {
    error: statusCode === 500 ? "internal_server_error" : err.message || "error",
  };

  if (!isProduction && err.exposeStack !== false && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
