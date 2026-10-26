import { useState, useEffect } from "react";
import { api } from "../api";

interface FindingDetailProps {
  projectId: string;
  findingId: string;
  onBack: () => void;
  onStatusChange: (newStatus: string) => void;
}

export function FindingDetail({ projectId, findingId, onBack, onStatusChange }: FindingDetailProps) {
  const [finding, setFinding] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${projectId}/findings/${findingId}`),
      api.get(`/audit/${projectId}`),
    ])
      .then(([fData, aData]: any[]) => {
        setFinding(fData.finding);
        setAudit(aData.auditEvents || []);
      })
      .catch((err: any) => setError(err.message || "Failed to load finding"))
      .finally(() => setLoading(false));
  }, [projectId, findingId]);

  if (loading) return <div className="loading">Loading finding…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!finding) return <div className="empty">Finding not found.</div>;

  const statusTransitions: Record<string, string[]> = {
    new: ["triaged", "reopened"],
    triaged: ["in_progress", "accepted_risk", "reopened"],
    in_progress: ["resolved", "reopened"],
    resolved: ["reopened", "in_progress"],
    accepted_risk: ["reopened"],
    reopened: ["in_progress", "accepted_risk"],
  };

  return (
    <div className="finding-detail-page">
      <div className="header-row">
        <button className="btn btn-secondary" onClick={onBack}>← Back to findings</button>
        <h1>{finding.title}</h1>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Details</h2>
          <p><strong>Source:</strong> {finding.source}</p>
          <p><strong>Rule ID:</strong> {finding.ruleId || "—"}</p>
          <p><strong>Component:</strong> {finding.component || "—"}</p>
          <p><strong>Severity:</strong> <span className={`badge severity-${finding.severity}`}>{finding.severity}</span></p>
          <p><strong>Confidence:</strong> {finding.confidence}</p>
          <p><strong>Status:</strong>
            <select
              value={finding.status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={!statusTransitions[finding.status]?.includes(e.target.value) && e.target.value !== finding.status}
            >
              {statusTransitions[finding.status]?.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              )) || <option value={finding.status}>{finding.status}</option>}
            </select>
          </p>
          <p><strong>Assignee:</strong> {finding.assigneeId || "Unassigned"}</p>
          <p><strong>CWE:</strong> {finding.cwe || "—"}</p>
          <p><strong>CVE:</strong> {finding.cve || "—"}</p>
        </div>

        <div className="card">
          <h2>Description</h2>
          <p className="description">{finding.description || "No description provided."}</p>
          <h3>Evidence</h3>
          <p className="description">{finding.evidence || "—"}</p>
          <h3>Remediation Notes</h3>
          <p className="description">{finding.remediationNotes || "—"}</p>
          <p><strong>First seen:</strong> {new Date(finding.firstSeen).toLocaleString()}</p>
          <p><strong>Last seen:</strong> {new Date(finding.lastSeen).toLocaleString()}</p>
          <p><strong>Created:</strong> {new Date(finding.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <h2>Audit timeline</h2>
        {audit.length === 0 ? (
          <p className="muted">No audit events.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>When</th><th>Action</th><th>Summary</th><th>Actor</th></tr>
            </thead>
            <tbody>
              {audit.map((e: any) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.eventType}</td>
                  <td>{e.summary}</td>
                  <td>{e.actorId || "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
