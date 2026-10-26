/**
 * @fileoverview Authentication primitives.
 *
 * - Password hashing with argon2id (via the `argon2` package).
 * - Constant-time comparison handled internally by argon2.
 * - No default passwords; no password logging; no plaintext storage.
 */

import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  saltLength: 16,
} as const;

/**
 * Hash a plaintext password for storage. Never returns plaintext.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a candidate password against a stored hash. Constant-time.
 * Returns false (never throws) for invalid hashes to avoid oracle behavior.
 */
export async function verifyPassword(
  candidate: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}

import { randomBytes } from "node:crypto";

/**
 * Generate a cryptographically random, opaque session ID with no user data.
 */
export function generateSessionId(): string {
  const bytes = randomBytes(32);
  return bytes.toString("hex");
}
