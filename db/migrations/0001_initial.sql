-- VulnLedger initial schema (v1.0.0)
-- Generated from apps/api/src/schema.ts
-- Apply with: psql "$DATABASE_URL" -f db/migrations/0001_initial.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sessions table (connect-pg-simple store)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions(expire);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Memberships (unique project/user pair)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(1000) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source VARCHAR(200) NOT NULL,
  rule_id VARCHAR(200) NOT NULL DEFAULT '',
  fingerprint VARCHAR(200),
  component VARCHAR(500) NOT NULL DEFAULT '',
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  confidence VARCHAR(20) NOT NULL CHECK (confidence IN ('low','medium','high')),
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','in_progress','resolved','accepted_risk','reopened')),
  cwe VARCHAR(20),
  cve VARCHAR(50),
  evidence TEXT NOT NULL DEFAULT '',
  remediation_notes TEXT NOT NULL DEFAULT '',
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS IDX_findings_project_id ON findings(project_id);
CREATE INDEX IF NOT EXISTS IDX_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS IDX_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS IDX_findings_assignee_id ON findings(assignee_id);

-- Import batches
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source VARCHAR(200) NOT NULL,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit events
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  event_type VARCHAR(100) NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IDX_audit_events_project_id ON audit_events(project_id);
CREATE INDEX IF NOT EXISTS IDX_audit_events_entity ON audit_events(entity_type, entity_id);

-- Trigger to keep updated_at current on users/projects
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Findings updated_at via application layer (Drizzle), not a trigger, to keep
-- the ORM contract explicit.
