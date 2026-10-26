import { useState } from "react";
import { api } from "../api";

interface CreateFindingProps {
  projectId: string;
  onCreated: (finding: any) => void;
}

export function CreateFinding({ projectId, onCreated }: CreateFindingProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    source: "",
    ruleId: "",
    component: "",
    severity: "medium",
    confidence: "medium",
    status: "new",
    cwe: "",
    cve: "",
    evidence: "",
    remediationNotes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const created = await api.post(`/projects/${projectId}/findings`, form);
      onCreated(created.finding);
    } catch (err: any) {
      setError(err.body?.details
        ? err.body.details.map((d: any) => `${d.field.join(".")}: ${d.message}`).join("; ")
        : err.message || "Failed to create finding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-finding-page">
      <h1>Create finding</h1>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Title <span className="req">*</span></label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Source / tool <span className="req">*</span></label>
          <input
            required
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Rule ID</label>
          <input
            value={form.ruleId}
            onChange={(e) => setForm({ ...form, ruleId: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Component <span className="req">*</span></label>
          <input
            required
            value={form.component}
            onChange={(e) => setForm({ ...form, component: e.target.value })}
          />
        </div>
        <div className="field row">
          <div className="field-half">
            <label>Severity</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="info">Info</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="field-half">
            <label>Confidence</label>
            <select
              value={form.confidence}
              onChange={(e) => setForm({ ...form, confidence: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="accepted_risk">Accepted risk</option>
            <option value="reopened">Reopened</option>
          </select>
        </div>
        <div className="field">
          <label>CWE</label>
          <input
            value={form.cwe}
            onChange={(e) => setForm({ ...form, cwe: e.target.value })}
          />
        </div>
        <div className="field">
          <label>CVE</label>
          <input
            value={form.cve}
            onChange={(e) => setForm({ ...form, cve: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Evidence</label>
          <textarea
            value={form.evidence}
            onChange={(e) => setForm({ ...form, evidence: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Remediation notes</label>
          <textarea
            value={form.remediationNotes}
            onChange={(e) => setForm({ ...form, remediationNotes: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create finding"}
        </button>
        <button type="button" className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => window.dispatchEvent(new Event("nav:findings"))}>
          Cancel
        </button>
      </form>
    </div>
  );
}
