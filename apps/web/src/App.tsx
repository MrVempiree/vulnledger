import { useState } from "react";
import { Layout } from "./components/Layout";
import { LoginForm } from "./components/LoginForm";
import { ProjectList } from "./components/ProjectList";
import { FindingsTable } from "./components/FindingsTable";
import { FindingDetail } from "./components/FindingDetail";
import { CreateFinding } from "./components/CreateFinding";
import { ImportPreview } from "./components/ImportPreview";
import { useAuth } from "./contexts/AuthContext";

type View =
  | "login"
  | "projects"
  | "findings"
  | "finding-detail"
  | "create-finding"
  | "import";

export default function App() {
  const { user, loading, isAuthenticated } = useAuth();
  const [view, setView] = useState<View>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  if (loading) return <div className="loading">Loading…</div>;
  if (!isAuthenticated()) return <LoginForm onSuccess={() => setView("projects")} />;

  return (
    <Layout>
      {view === "projects" && (
        <ProjectList onProjectSelect={(id) => { setSelectedProjectId(id); setView("findings"); }} />
      )}
      {view === "findings" && selectedProjectId && (
        <FindingsTable
          projectId={selectedProjectId}
          onSelect={(f) => { setSelectedFindingId(f.id); setView("finding-detail"); }}
        />
      )}
      {view === "finding-detail" && selectedProjectId && selectedFindingId && (
        <FindingDetail
          projectId={selectedProjectId}
          findingId={selectedFindingId}
          onBack={() => { setView("findings"); }}
          onStatusChange={(newStatus) => {
            // Stub: real status change calls the PATCH API in the findings route.
            console.log("Status change requested:", newStatus);
          }}
        />
      )}
      {view === "create-finding" && selectedProjectId && (
        <CreateFinding
          projectId={selectedProjectId}
          onCreated={() => { setCreating(false); }}
        />
      )}
      {view === "import" && selectedProjectId && (
        <ImportPreview projectId={selectedProjectId} onDone={() => { setView("findings"); setImporting(false); }} />
      )}

      {!selectedProjectId && view !== "projects" && (
        <div className="empty">Select a project to begin.</div>
      )}
    </Layout>
  );
}
