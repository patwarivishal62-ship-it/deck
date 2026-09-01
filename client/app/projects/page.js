"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card, { CardHeading } from "@/components/app/Card";
import { SegmentedControl, LightSelect } from "@/components/app/Pills";
import { EmptyState, ErrorBanner, PrimaryButton } from "@/components/app/UI";
import SummaryCard from "@/components/dashboard/SummaryCard";
import DashboardProjectCard from "@/components/dashboard/DashboardProjectCard";
import ProjectFormModal from "@/components/ProjectFormModal";
import QuickAddTaskModal from "@/components/QuickAddTaskModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FolderKanban, ListTodo, Plus, Zap, CheckCircle2, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { getProjectStatus } from "@/lib/projectStatus";
import { todayISO } from "@/lib/dashboard";
import { PROJECT_SORTS } from "@/lib/constants";

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

function sortProjects(list, sort) {
  const sorted = [...list];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    case "name":
      return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    case "dueDate":
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case "priority":
      return sorted.sort(
        (a, b) => (PRIORITY_RANK[b.priority] ?? 1) - (PRIORITY_RANK[a.priority] ?? 1)
      );
    case "newest":
    default:
      return sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
}

function ProjectsView() {
  const [projects, setProjects] = useState(null); // null = loading
  const [workspaces, setWorkspaces] = useState([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | in_progress | pending | completed
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("active"); // active | archived | all

  const [formOpen, setFormOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const archived = view === "active" ? false : view === "archived" ? true : "all";
      const data = await api.listProjects({ archived });
      setProjects(data.projects);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(err.message);
      setProjects((prev) => prev ?? []);
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = projects === null;
  const list = projects || [];

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    let out = list;
    if (q) {
      out = out.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      out = out.filter((p) => getProjectStatus(p) === statusFilter);
    }
    if (priority) {
      out = out.filter((p) => (p.priority || "medium") === priority);
    }
    return sortProjects(out, sort);
  }, [list, q, statusFilter, priority, sort]);

  const summary = useMemo(() => {
    const active = list.filter((p) => !p.archived);
    const allTasks = active.flatMap((p) => p.tasks || []);
    const today = todayISO();
    const overdue = allTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
    return {
      total: active.length,
      inProgress: active.filter((p) => getProjectStatus(p) === "in_progress").length,
      completed: active.filter((p) => getProjectStatus(p) === "completed").length,
      doneTasks: allTasks.filter((t) => t.status === "done").length,
      totalTasks: allTasks.length,
      overdue,
    };
  }, [list]);

  async function handleCreateProject(values) {
    const data = await api.createProject(values);
    if (data?.project && view !== "archived") {
      setProjects((prev) => [data.project, ...(prev || [])]);
    }
  }

  async function handleArchiveToggle(project) {
    setError("");
    const wasArchived = project.archived;
    // Optimistic: drop from the current view, restore on failure.
    setProjects((prev) => (prev || []).filter((p) => p.id !== project.id));
    try {
      await api.updateProject(project.id, { archived: !wasArchived });
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteProject(deleteTarget.id);
      setProjects((prev) => (prev || []).filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = q || statusFilter !== "all" || priority !== "" || sort !== "newest";
  const completionPct =
    summary.totalTasks > 0 ? Math.round((summary.doneTasks / summary.totalTasks) * 100) : 0;

  return (
    <AppShell search={search} onSearchChange={setSearch} searchPlaceholder="Search projects…">
      <PageHeading
        title="Projects"
        subtitle="Every campaign in one place — track goals, tasks, and progress across your workspaces."
        actions={
          <>
            <PrimaryButton onClick={() => setQuickAddOpen(true)} disabled={list.length === 0}
              title={list.length === 0 ? "Create a project first" : undefined}>
              <Zap size={14} strokeWidth={2.2} />
              <span className="hidden sm:inline">Quick add task</span>
              <span className="sm:hidden">Task</span>
            </PrimaryButton>
            <PrimaryButton onClick={() => setFormOpen(true)}>
              <Plus size={15} strokeWidth={2.2} />
              New project
            </PrimaryButton>
          </>
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Active projects"
          value={loading ? "—" : summary.total}
          info={
            summary.total > 0
              ? `${summary.inProgress} in progress · ${summary.completed} completed`
              : "No active projects yet"
          }
          icon={FolderKanban}
          iconBg="#F1EDFF"
          iconColor="#7C5CFF"
        />
        <SummaryCard
          label="Tasks completed"
          value={loading ? "—" : summary.doneTasks}
          info={
            summary.totalTasks > 0
              ? `${completionPct}% of ${summary.totalTasks} tasks`
              : "No tasks yet"
          }
          infoTone={summary.totalTasks > 0 && completionPct >= 50 ? "positive" : "muted"}
          icon={CheckCircle2}
          iconBg="#E7F6EF"
          iconColor="#12B76A"
        />
        <SummaryCard
          label="Overdue tasks"
          value={loading ? "—" : summary.overdue}
          info={summary.overdue > 0 ? "needs attention" : summary.totalTasks > 0 ? "everything on schedule" : "no tasks yet"}
          infoTone={summary.overdue > 0 ? "danger" : "positive"}
          icon={CalendarClock}
          iconBg={summary.overdue > 0 ? "#FDEEEF" : "#E7F6EF"}
          iconColor={summary.overdue > 0 ? "#DC3D43" : "#12B76A"}
        />
        <SummaryCard
          label="Workspaces"
          value={loading ? "—" : workspaces.length}
          info={workspaces.length > 1 ? "across multiple workspaces" : "your personal workspace"}
          icon={ListTodo}
          iconBg="#F1F4F9"
          iconColor="#5B6B7F"
        />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Filter projects by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "in_progress", label: "In progress" },
            { value: "pending", label: "Pending" },
            { value: "completed", label: "Completed" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            ariaLabel="Project view"
            value={view}
            onChange={setView}
            options={[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ]}
          />
          <LightSelect ariaLabel="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </LightSelect>
          <LightSelect ariaLabel="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)}>
            {PROJECT_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </LightSelect>
        </div>
      </div>

      {/* Project list */}
      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[118px] animate-pulse rounded-2xl border border-line bg-card"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FolderKanban} title={hasFilters ? "No projects match these filters" : "No projects yet"}>
            {hasFilters ? (
              <p>Try clearing the search, status, or priority filters.</p>
            ) : (
              <>
                <p>Create your first project to start tracking goals, tasks, and progress.</p>
                <PrimaryButton className="mt-4" onClick={() => setFormOpen(true)}>
                  <Plus size={15} strokeWidth={2.2} />
                  Create project
                </PrimaryButton>
              </>
            )}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => (
              <DashboardProjectCard
                key={project.id}
                project={project}
                onArchiveToggle={handleArchiveToggle}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateProject}
        workspaces={workspaces}
      />

      <QuickAddTaskModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        projects={list}
        onCreated={load}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete project?"
        message={`This will permanently delete "${deleteTarget?.name}" along with all of its goals and tasks.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleting}
      />
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGuard>
      <ProjectsView />
    </AuthGuard>
  );
}
