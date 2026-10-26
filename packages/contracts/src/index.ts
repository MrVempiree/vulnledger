/**
 * @fileoverview Shared Zod schemas and TypeScript types for VulnLedger.
 *
 * These schemas validate both API request bodies and JSON import payloads.
 * Keeping them in a shared package lets the API and any future clients agree
 * on a single contract without drift.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitive / reusable validators
// ---------------------------------------------------------------------------

export const emailSchema = z.string().email().toLowerCase().trim();
export const passwordSchema = z.string().min(12).max(128);
export const uuidSchema = z.string().uuid();
export const slugSchema = z.string().min(1).max(100).trim();
export const nonEmptyString = z.string().min(1).max(1000).trim();

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const projectInsertSchema = z.object({
  name: slugSchema,
  description: z.string().max(2000).optional().default(""),
});

export const projectSchema = projectInsertSchema.extend({
  id: uuidSchema,
  creatorId: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;
export type NewProject = z.infer<typeof projectInsertSchema>;

// ---------------------------------------------------------------------------
// Project membership
// ---------------------------------------------------------------------------

export const membershipRoleSchema = z.enum(["admin", "member"]);

export const membershipSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  userId: uuidSchema,
  role: membershipRoleSchema,
  createdAt: z.string().datetime(),
});

export type Membership = z.infer<typeof membershipSchema>;

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

export const findingSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const findingConfidenceSchema = z.enum([
  "low",
  "medium",
  "high",
]);

export const findingStatusSchema = z.enum([
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "accepted_risk",
  "reopened",
]);

// Allowed status transitions: current -> next[]
export const FINDING_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["triaged", "reopened"],
  triaged: ["in_progress", "accepted_risk", "reopened"],
  in_progress: ["resolved", "reopened"],
  resolved: ["reopened", "in_progress"],
  accepted_risk: ["reopened"],
  reopened: ["in_progress", "accepted_risk"],
};

export const findingInsertSchema = z.object({
  projectId: uuidSchema,
  title: nonEmptyString,
  description: z.string().max(10000).optional().default(""),
  source: z.string().min(1).max(200).trim(),
  ruleId: z.string().max(200).optional().default(""),
  fingerprint: z.string().max(200).optional().nullable(),
  component: z.string().max(500).optional().default(""),
  severity: findingSeveritySchema,
  confidence: findingConfidenceSchema,
  status: findingStatusSchema.default("new"),
  cwe: z.string().max(20).optional().nullable(),
  cve: z.string().max(50).optional().nullable(),
  evidence: z.string().max(5000).optional().default(""),
  remediationNotes: z.string().max(10000).optional().default(""),
  assigneeId: uuidSchema.optional().nullable(),
});

export const findingSchema = findingInsertSchema.extend({
  id: uuidSchema,
  firstSeen: z.string().datetime(),
  lastSeen: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: uuidSchema,
  resolvedAt: z.string().datetime().nullable(),
});

export type Finding = z.infer<typeof findingSchema>;
export type NewFinding = z.infer<typeof findingInsertSchema>;

// ---------------------------------------------------------------------------
// JSON import
// ---------------------------------------------------------------------------

export const importFindingSchema = findingInsertSchema.omit({
  projectId: true, // supplied by the import target project
});

export const importPayloadSchema = z.object({
  source: z.string().min(1).max(200).trim(),
  findings: z.array(importFindingSchema).max(5000),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
