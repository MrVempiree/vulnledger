import { useState } from "react";
import { api } from "../api";

interface ImportPreviewProps {
  projectId: string;
  onDone: () => void;
}

export function ImportPreview({ projectId, onDone }: ImportPreviewProps) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError("");
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setSubmitting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.post(`/import/${projectId}/preview`, payload);
      setPreview(result.preview);
      setStep("preview");
    } catch (err: any) {
      setError(err.body?.details
        ? err.body.details.map((d: any) => `${d.field.join(".")}: ${d.message}`).join("; ")
        : err.message || "Failed to preview import.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      await api.post(`/import/${projectId}/confirm`, {
        source: preview.source,
        findings: preview.details
          .filter((d: any) => d.status === "accepted")
          .map((d: any) => d.title) // placeholder; real flow passes full finding
          .map((t: string, i: number) => ({ title: t })),
      });
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Import commit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "upload") {
    return (
      <div className="import-page">
        <h1>JSON import</h1>
        <p className="muted">
          Upload a JSON file with your findings. You'll preview valid/invalid
          and duplicate findings before anything is saved.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handlePreview}>
          <div className="field">
            <label>JSON file</label>
            <input type="file" accept=".json" onChange={handleFileChange} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting || !file}>
            {submitting ? "Previewing…" : "Preview import"}
          </button>
        </form>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="import-page">
        <h1>Import preview</h1>
        <p>
          <strong>Source:</strong> {preview.source} &nbsp;•&nbsp;
          <strong>Total:</strong> {preview.total} &nbsp;•&nbsp;
          <strong>Accepted:</strong> {preview.accepted} &nbsp;•&nbsp;
          <strong>Rejected:</strong> {preview.rejected}
        </p>
        {preview.details.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Status</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {preview.details.map((d: any, i: number) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{d.title}</td>
                  <td>{d.status}</td>
                  <td>{d.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="actions">
          <button className="btn btn-primary" disabled={submitting || preview.accepted === 0} onClick={handleConfirm}>
            {submitting ? "Committing…" : "Commit accepted findings"}
          </button>
          <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="import-page">
      <h1>Import complete</h1>
      <p className="muted">Findings have been imported. An audit event was recorded.</p>
      <button className="btn btn-primary" onClick={onDone}>Back to findings</button>
    </div>
  );
}
