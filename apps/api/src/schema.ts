/**
 * @fileoverview Drizzle ORM schema for VulnLedger.
 *
 * Defines users, projects, memberships, findings, import batches, and audit
 * events. All timestamps are stored as timestamptz (UTC). Password hashes are
 * never stored plaintext; session IDs are opaque random values.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);
export const findingStatusEnum = pgEnum("finding_status", [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "accepted_risk",
  "reopened",
]);
export const findingSeverityEnum = pgEnum("finding_severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
export const findingConfidenceEnum = pgEnum("finding_confidence", [
  "low",
  "medium",
  "high",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("member"),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull().default(""),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 1000 }).notNull(),
  description: text("description").notNull().default(""),
  source: varchar("source", { length: 200 }).notNull(),
  ruleId: varchar("rule_id", { length: 200 }).notNull().default(""),
  fingerprint: varchar("fingerprint", { length: 200 }),
  component: varchar("component", { length: 500 }).notNull().default(""),
  severity: findingSeverityEnum("severity").notNull(),
  confidence: findingConfidenceEnum("confidence").notNull(),
  status: findingStatusEnum("status").notNull().default("new"),
  cwe: varchar("cwe", { length: 20 }),
  cve: varchar("cve", { length: 50 }),
  evidence: text("evidence").notNull().default(""),
  remediationNotes: text("remediation_notes").notNull().default(""),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  source: varchar("source", { length: 200 }).notNull(),
  acceptedCount: integer("accepted_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: uuid("entity_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Unique constraint on (projectId, userId) for memberships is enforced via
// a unique index in drizzle-kit migrations (see db/migrations).
