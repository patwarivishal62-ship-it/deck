"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import SummaryCard from "@/components/dashboard/SummaryCard";
import DashboardProjectCard from "@/components/dashboard/DashboardProjectCard";
import TodayTasks from "@/components/dashboard/TodayTasks";
import ProjectFormModal from "@/components/ProjectFormModal";
import ConfirmModal from "@/components/ConfirmModal";
import { FolderKanban, ListTodo, CalendarClock, Plus, Mic, Sparkles, Bell, Target, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { getProjectStatus } from "@/lib/projectStatus";
import { firstNameFor, partOfDay, todayISO, collectTodayTasks } from "@/lib/dashboard";

const MAX_PROJECTS = 5;
const MAX_TASKS = 6;

function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-56 rounded-lg bg-paper-2" />
      <div className="mt-2 h-4 w-72 rounded bg-paper-2" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-card" />
        ))}
      </div>
      <div className="mt-8 h-[340px] rounded-2xl border border-line bg-card" />
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading
  const [workspaces, setWorkspaces] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      // Active projects only, soonest due date first — the dashboard is a
      // "what needs attention" view.
      const data = await api.listProjects({ archived: false, sort: "dueDate" });
      setProjects(data.projects);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(err.message);
      setProjects((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = projects === null;
  const list = projects || [];

  const q = search.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [list, q]);

  const filteredTasks = useMemo(() => {
    const tasks = collectTodayTasks(list);
    if (!q) return tasks;
    return tasks.filter(
      (t) => t.title?.toLowerCase().includes(q) || t.project?.name?.toLowerCase().includes(q)
    );
  }, [list, q]);

  // Summary stats — all derived from real data.
  const summary = useMemo(() => {
    const total = list.length;
    const inProgress = list.filter((p) => getProjectStatus(p) === "in_progress").length;
    const completed = list.filter((p) => getProjectStatus(p) === "completed").length;
    const allTasks = list.flatMap((p) => p.tasks || []);
    const doneTasks = allTasks.filter((t) => t.status === "done").length;
    const today = todayISO();
    const dueToday = allTasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= today);
    const overdue = dueToday.filter((t) => t.dueDate < today).length;
    return {
      total,
      inProgress,
      completed,
      doneTasks,
      totalTasks: allTasks.length,
      completionPct: allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0,
      dueToday: dueToday.length,
      overdue,
    };
  }, [list]);

  const greetingName = firstNameFor(user);

  function greetingSubtitle() {
    if (loading) return "Loading your workspace…";
    if (summary.total === 0) return "Your workspace is all clear — create a project to get moving.";
    const parts = [
      `${summary.total} active project${summary.total !== 1 ? "s" : ""}`,
      summary.dueToday > 0
        ? `${summary.dueToday} task${summary.dueToday !== 1 ? "s" : ""} due today`
        : "nothing due today",
    ];
    return `You have ${parts[0]} and ${parts[1]}.`;
  }

  async function handleCreateProject(values) {
    const data = await api.createProject(values);
    if (data?.project) setProjects((prev) => [data.project, ...(prev || [])]);
  }

  async function handleArchiveToggle(project) {
    setError("");
    setProjects((prev) => (prev || []).filter((p) => p.id !== project.id));
    try {
      await api.updateProject(project.id, { archived: true });
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

  // Checkbox toggle for Today's tasks — optimistic update, rollback on error.
  async function handleToggleTask(task) {
    const nextStatus = task.status === "done" ? "todo" : "done";
    setTogglingId(task.id);
    setProjects((prev) =>
      (prev || []).map((p) =>
        p.id !== task.projectId
          ? p
          : { ...p, tasks: (p.tasks || []).map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)) }
      )
    );
    try {
      await api.updateTask(task.projectId, task.id, { status: nextStatus });
    } catch (err) {
      setError(err.message);
      setProjects((prev) =>
        (prev || []).map((p) =>
          p.id !== task.projectId
            ? p
            : { ...p, tasks: (p.tasks || []).map((t) => (t.id === task.id ? { ...t, status: task.status } : t)) }
        )
      );
    } finally {
      setTogglingId(null);
    }
  }

  const showProjects = q ? filteredProjects : filteredProjects.slice(0, MAX_PROJECTS);
  const searching = q.length > 0;

  return (
    <AppShell search={search} onSearchChange={setSearch}>
      {error && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-error-line bg-error-tint px-4 py-3 text-sm text-error-text">
              <span>{error}</span>
              <button type="button" onClick={load} className="shrink-0 font-semibold underline underline-offset-2">
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* Greeting */}
              <div>
                <h1 className="font-display text-[22px] font-bold tracking-tight text-text sm:text-2xl">
                  Good {partOfDay()}
                  {greetingName ? `, ${greetingName}` : ""}
                </h1>
                <p className="mt-1 text-sm text-text-soft">{greetingSubtitle()}</p>
              </div>

              {/* Summary cards */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SummaryCard
                  label="Active projects"
                  value={summary.total}
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
                  value={summary.doneTasks}
                  info={
                    summary.totalTasks > 0
                      ? `${summary.completionPct}% of ${summary.totalTasks} tasks`
                      : "No tasks yet"
                  }
                  infoTone={summary.totalTasks > 0 && summary.completionPct >= 50 ? "positive" : "muted"}
                  icon={ListTodo}
                  iconBg="#E7F6EF"
                  iconColor="#12B76A"
                />
                <SummaryCard
                  label="Due today"
                  value={summary.dueToday}
                  info={
                    summary.overdue > 0
                      ? `${summary.overdue} overdue`
                      : summary.dueToday > 0
                        ? "due by end of day"
                        : "All clear for today"
                  }
                  infoTone={summary.overdue > 0 ? "danger" : summary.dueToday > 0 ? "accent" : "positive"}
                  icon={CalendarClock}
                  iconBg="#FEF4E4"
                  iconColor="#E8A23D"
                />
              </div>

                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <h2 id="dashboard-projects-heading" className="font-display text-base font-bold tracking-tight text-text">
                    Projects
                  </h2>
                  <Link
                    href="/projects"
                    className="text-[13px] font-semibold text-signal transition hover:text-signal"
                  >
                    View all
                  </Link>
                </div>

                {showProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
                      <FolderKanban size={20} strokeWidth={1.8} />
                    </span>
                    {searching ? (
                      <>
                        <p className="mt-3 text-sm font-semibold text-text">No projects match “{search.trim()}”</p>
                        <p className="mt-1 text-xs text-text-faint">Try a different search term.</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-semibold text-text">No projects yet</p>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-text-faint">
                          Create your first project to see goals, tasks, and progress here.
                        </p>
                        <button
                          type="button"
                          onClick={() => setFormOpen(true)}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#7C5CFF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)] transition hover:bg-[#6A4AF0]"
                        >
                          <Plus size={15} strokeWidth={2.2} />
                          Create project
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {showProjects.map((project) => (
                      <DashboardProjectCard
                        key={project.id}
                        project={project}
                        onArchiveToggle={handleArchiveToggle}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                    {!searching && filteredProjects.length > MAX_PROJECTS && (
                      <Link
                        href="/projects"
                        className="block rounded-2xl border border-dashed border-line bg-card px-4 py-3.5 text-center text-[13px] font-semibold text-signal transition hover:border-[#7C5CFF]/40 hover:bg-card"
                      >
                        View {filteredProjects.length - MAX_PROJECTS} more project
                        {filteredProjects.length - MAX_PROJECTS !== 1 ? "s" : ""}
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* Today's Tasks */}
              <section className="mt-8" aria-labelledby="dashboard-tasks-heading">
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <h2 id="dashboard-tasks-heading" className="font-display text-base font-bold tracking-tight text-text">
                    Today&apos;s Tasks
                  </h2>
                  <Link
                    href="/projects"
                    className="text-[13px] font-semibold text-signal transition hover:text-signal"
                  >
                    View all
                  </Link>
                </div>

                <TodayTasks
                  tasks={filteredTasks}
                  loading={loading}
                  onToggle={handleToggleTask}
                  togglingId={togglingId}
                  max={searching ? undefined : MAX_TASKS}
                />
              </section>

            </>
          )}

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateProject}
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
    </AppShell>
  );
}

// Post-login Overview dashboard — the screen users land on after signing in.
export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
