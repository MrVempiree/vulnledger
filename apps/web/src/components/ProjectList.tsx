import { useEffect, useState } from "react";
import { api } from "../api";

export interface Project {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export function ProjectList({ onProjectSelect }: { onProjectSelect: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/projects")
      .then((data: any) => setProjects(data.projects || []))
      .catch((err: any) => setError(err.message || "Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading projects…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="project-list-page">
      <h1>Projects</h1>
      {projects.length === 0 && (
        <div className="empty">
          <p>No projects available.</p>
          <p>Ask an administrator to create a project and add you as a member.</p>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.description || "—"}</td>
              <td>{new Date(p.createdAt).toLocaleDateString()}</td>
              <td>
                <button className="btn" onClick={() => onProjectSelect(p.id)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
