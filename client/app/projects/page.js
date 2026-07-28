"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import ProjectCard from "@/components/ProjectCard";
import ProjectFormModal from "@/components/ProjectFormModal";
import ConfirmModal from "@/components/ConfirmModal";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import { Button, TextInput, Select } from "@/components/FormControls";
import { api } from "@/lib/api";
import { summarizeProjectStatuses } from "@/lib/projectStatus";
import { PRIORITIES, PRIORITY_KEYS, PROJECT_SORTS } from "@/lib/constants";

function ProjectsDashboard() {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("newest");
  const [archivedView, setArchivedView] = useState("active"); // "active" | "archived" | "all"

  // Debounce free-text search/tags input so we're not firing a request on
  // every keystroke.
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setTags(tagsInput);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, tagsInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const archived = archivedView === "active" ? false : archivedView === "archived" ? true : "all";
      const data = await api.listProjects({
        search: search || undefined,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        priority: priority || undefined,
        archived,
        sort,
      });
      setProjects(data.projects);
      setWorkspaces(data.workspaces || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, tags, priority, sort, archivedView]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(values) {
    const data = await api.createProject(values);
    // Only splice into the current view if it actually belongs there
    // (e.g. skip it if we're viewing "Archived" only, a new project is never archived).
    if (archivedView !== "archived") {
      setProjects((prev) => [...prev, data.project]);
    }
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

  async function handleArchiveToggle(project) {
    try {
      await api.updateProject(project.id, { archived: !project.archived });
      // The toggled project may no longer belong in the current filtered view
      // (e.g. archiving it while viewing "Active"), so just drop it locally
      // rather than re-fetching everything.
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err) {
      setError(err.message);
    }
  }

  const hasActiveFilters = search || tags || priority || sort !== "newest" || archivedView !== "active";

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

        {/* Search, filters, sort */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <TextInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search projects…"
            />
          </div>
          <div className="w-40">
            <TextInput
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Filter by tag…"
            />
          </div>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-40 shrink-0"
          >
            <option value="">All priorities</option>
            {PRIORITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {PRIORITIES[key].label}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-40 shrink-0">
            {PROJECT_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select
            value={archivedView}
            onChange={(e) => setArchivedView(e.target.value)}
            className="w-32 shrink-0"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
        </div>

        {error && <p className="mb-4 text-sm text-signal-deep">{error}</p>}

        {!loading && archivedView === "active" && !hasActiveFilters && projects.length > 0 && (
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
            {hasActiveFilters ? (
              <p className="text-sm text-text-soft">No projects match these filters.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-text-soft">No projects yet.</p>
                <Button onClick={() => setFormOpen(true)}>Create your first project</Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={setDeleteTarget}
                onArchiveToggle={handleArchiveToggle}
                showWorkspaceLabel={workspaces.length > 1}
              />
            ))}
          </div>
        )}
      </main>

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        workspaces={workspaces}
      />

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
