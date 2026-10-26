import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

export interface Finding {
  id: string;
  projectId: string;
  title: string;
  description: string;
  source: string;
  ruleId: string;
  fingerprint: string | null;
  component: string;
  severity: string;
  confidence: string;
  status: string;
  cwe: string | null;
  cve: string | null;
  evidence: string;
  remediationNotes: string;
  assigneeId: string | null;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  resolvedAt: string | null;
}

interface FindingsTableProps {
  projectId: string;
  onSelect: (finding: Finding) => void;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function FindingsTable({ projectId, onSelect }: FindingsTableProps) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ severity: "", status: "", search: "" });

  const load = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { search: filters.search } : {}),
    });
    api
      .get(`/projects/${projectId}?${params.toString()}`)
      .then((data: any) => {
        setFindings(data.findings || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch((err: any) => setError(err.message || "Failed to load findings"))
      .finally(() => setLoading(false));
  }, [projectId, page, pageSize, filters]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading">Loading findings…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="findings-table-page">
      <div className="toolbar">
        <input
          className="input"
          placeholder="Search title…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <select
          className="input"
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
        <select
          className="input"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="triaged">Triaged</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="accepted_risk">Accepted risk</option>
          <option value="reopened">Reopened</option>
        </select>
      </div>

      {findings.length === 0 && (
        <div className="empty">
          <p>No findings in this project.</p>
          <p>Create your first finding or import results from a security tool.</p>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Source</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => (
            <tr key={f.id} onClick={() => onSelect(f)} className="clickable">
              <td>{f.title}</td>
              <td>
                <span className={`badge severity-${f.severity}`}>{f.severity}</span>
              </td>
              <td>
                <span className={`badge status-${f.status}`}>{f.status}</span>
              </td>
              <td>{f.source}</td>
              <td>{new Date(f.createdAt).toLocaleDateString()}</td>
              <td>View</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <p>
          Showing {findings.length} of {total} findings — page {page} of{" "}
          {Math.ceil(total / pageSize)}
        </p>
      </div>
    </div>
  );
}
