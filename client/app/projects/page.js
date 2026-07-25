"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import ProjectCard from "@/components/ProjectCard";
import ProjectFormModal from "@/components/ProjectFormModal";
import ConfirmModal from "@/components/ConfirmModal";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import { Button } from "@/components/FormControls";
import { api } from "@/lib/api";
import { summarizeProjectStatuses } from "@/lib/projectStatus";

function ProjectsDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listProjects();
      setProjects(data.projects);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(values) {
    const data = await api.createProject(values);
    setProjects((prev) => [...prev, data.project]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text">Projects</h1>
            <p className="text-sm text-text-soft">Track goals and tasks across every campaign.</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>+ New project</Button>
        </div>

        {error && <p className="mb-4 text-sm text-signal-deep">{error}</p>}

        {!loading && projects.length > 0 && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(() => {
                const summary = summarizeProjectStatuses(projects);
                return (
                  <>
                    <StatCard label="Total projects" value={summary.total} />
                    <StatCard label="Completed" value={summary.completed} accent="good" />
                    <StatCard label="In progress" value={summary.in_progress} accent="signal" />
                    <StatCard label="Pending" value={summary.pending} accent="faint" />
                  </>
                );
              })()}
            </div>
            <div className="mb-6">
              <RecentActivity projects={projects} />
            </div>
          </>
        )}

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-card py-16 text-center">
            <p className="mb-3 text-sm text-text-soft">No projects yet.</p>
            <Button onClick={() => setFormOpen(true)}>Create your first project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </main>

      <ProjectFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete project?"
        message={`This will permanently delete "${deleteTarget?.name}" along with all of its goals and tasks.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard>
      <ProjectsDashboard />
    </AuthGuard>
  );
}
