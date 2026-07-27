"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import GoalCard from "@/components/GoalCard";
import TaskRow from "@/components/TaskRow";
import GoalFormModal from "@/components/GoalFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import ProjectFormModal from "@/components/ProjectFormModal";
import ProjectAccessModal from "@/components/ProjectAccessModal";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/FormControls";
import Meter from "@/components/Meter";
import { api } from "@/lib/api";
import { PRIORITIES } from "@/lib/constants";

function ProjectDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [deleteGoalTarget, setDeleteGoalTarget] = useState(null);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProject(id);
      setProject(data.project);
      setRole(data.role);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Project itself ---
  async function handleProjectSubmit(values) {
    const data = await api.updateProject(id, values);
    setProject((p) => ({ ...p, ...data.project }));
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    try {
      await api.deleteProject(id);
      router.replace("/projects");
    } catch (err) {
      setError(err.message);
      setDeletingProject(false);
    }
  }

  // --- Goals ---
  async function handleGoalSubmit(values) {
    if (editingGoal) {
      const data = await api.updateGoal(id, editingGoal.id, values);
      setProject((p) => ({ ...p, goals: p.goals.map((g) => (g.id === data.goal.id ? data.goal : g)) }));
    } else {
      const data = await api.createGoal(id, values);
      setProject((p) => ({ ...p, goals: [...p.goals, data.goal] }));
    }
  }

  async function handleDeleteGoal() {
    if (!deleteGoalTarget) return;
    setBusy(true);
    try {
      await api.deleteGoal(id, deleteGoalTarget.id);
      setProject((p) => ({
        ...p,
        goals: p.goals.filter((g) => g.id !== deleteGoalTarget.id),
        tasks: p.tasks.map((t) => (t.goalId === deleteGoalTarget.id ? { ...t, goalId: null } : t)),
      }));
      setDeleteGoalTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --- Tasks ---
  async function handleTaskSubmit(values) {
    if (editingTask) {
      const data = await api.updateTask(id, editingTask.id, values);
      const updatedTask = data.task;
      setProject((p) => ({
        ...p,
        tasks: p.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        goals: refreshGoalsAfterTaskChange(p, editingTask, updatedTask),
      }));
    } else {
      const data = await api.createTask(id, values);
      setProject((p) => ({ ...p, tasks: [...p.tasks, data.task] }));
      // A brand-new task can be created already "done", which bumps its goal —
      // simplest correct fix is to reload so the goal's currentValue is accurate.
      if (data.task.status === "done" && data.task.goalId) load();
    }
  }

  // When a task's status or goal link changes via the edit form, the linked
  // goal's currentValue may have shifted server-side — refetch just that goal
  // would be ideal, but a full reload keeps things simple and correct.
  function refreshGoalsAfterTaskChange(prevProject, oldTask, newTask) {
    const statusChanged = oldTask.status !== newTask.status;
    const goalChanged = oldTask.goalId !== newTask.goalId;
    if (statusChanged || goalChanged) {
      load();
    }
    return prevProject.goals;
  }

  async function handleCycleStatus(task) {
    try {
      const data = await api.cycleTaskStatus(id, task.id);
      setProject((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === data.task.id ? data.task : t)) }));
      // Status cycling can change a linked goal's currentValue — reload to reflect it.
      if (task.goalId) load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTask() {
    if (!deleteTaskTarget) return;
    setBusy(true);
    try {
      await api.deleteTask(id, deleteTaskTarget.id);
      setProject((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== deleteTaskTarget.id) }));
      setDeleteTaskTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <TopBar />
        <main className="mx-auto max-w-6xl px-5 py-8">
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-paper">
        <TopBar />
        <main className="mx-auto max-w-6xl px-5 py-8">
          <p className="text-sm text-signal-deep">{error || "Project not found."}</p>
          <Link href="/projects" className="mt-3 inline-block text-sm text-signal-deep underline">
            Back to projects
          </Link>
        </main>
      </div>
    );
  }

  const goalById = Object.fromEntries(project.goals.map((g) => [g.id, g]));
  // Admin/Owner can edit the project itself and manage goals; Members can
  // view goals and manage tasks, but not edit goals or the project.
  const canManage = role === "admin" || role === "owner";

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/projects" },
            { label: "Projects", href: "/projects" },
            { label: project.name },
          ]}
        />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-text-soft">{project.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white"
                style={{ backgroundColor: (PRIORITIES[project.priority] || PRIORITIES.medium).color }}
              >
                {(PRIORITIES[project.priority] || PRIORITIES.medium).label}
              </span>
              {project.archived && (
                <span className="rounded bg-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                  Archived
                </span>
              )}
              {project.dueDate && (
                <span className="text-xs text-text-faint">
                  Due {new Date(`${project.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              {project.tags && project.tags.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-text-soft"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {canManage && (
              <Button variant="secondary" onClick={() => setProjectFormOpen(true)}>
                Edit project
              </Button>
            )}
            {canManage && (
              <Button variant="secondary" onClick={() => setAccessModalOpen(true)}>
                Manage access
              </Button>
            )}
            {canManage && (
              <Button variant="destructive" onClick={() => setDeleteProjectOpen(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-signal-deep">{error}</p>}

        {/* Overall Progress Tracking */}
        {(project.goals.length > 0 || project.tasks.length > 0) && (
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Overall Progress Card */}
            <div className="rounded-card border border-line bg-card p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Overall Progress</p>
              <div className="mt-3">
                <Meter
                  value={project.tasks.filter((t) => t.status === "done").length}
                  target={project.tasks.length || 1}
                  color="#ff5a38"
                />
              </div>
              <p className="mt-2 text-sm text-text">
                {project.tasks.filter((t) => t.status === "done").length}/{project.tasks.length}
              </p>
            </div>

            {/* Goals On Track Card */}
            <div className="rounded-card border border-line bg-card p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Goals On Track</p>
              <p className="mt-4 text-3xl font-semibold text-text">
                {project.goals.filter((g) => g.currentValue >= g.targetValue).length}
              </p>
              <p className="mt-1 text-xs text-text-soft">
                {project.goals.length === 0 ? "no targets yet" : `of ${project.goals.length} goals`}
              </p>
            </div>

            {/* Tasks Done Card */}
            <div className="rounded-card border border-line bg-card p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Tasks Done</p>
              <p className="mt-4 text-3xl font-semibold text-text">
                {project.tasks.filter((t) => t.status === "done").length}
              </p>
              <p className="mt-1 text-xs text-text-soft">
                {project.tasks.length === 0 ? "no tasks yet" : "completed"}
              </p>
            </div>

            {/* Open Tasks Card */}
            <div className="rounded-card border border-line bg-card p-4">
              <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Open Tasks</p>
              <p className="mt-4 text-3xl font-semibold text-text">
                {project.tasks.filter((t) => t.status !== "done").length}
              </p>
              <p className="mt-1 text-xs text-text-soft">
                {project.tasks.filter((t) => t.status !== "done").length === 0 ? "all clear" : "remaining"}
              </p>
            </div>
          </section>
        )}

        {/* Goals */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-faint">
              Goals
            </h2>
            {canManage && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingGoal(null);
                  setGoalFormOpen(true);
                }}
              >
                + Add goal
              </Button>
            )}
          </div>

          {project.goals.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-text-soft">
              No goals yet. {canManage && "Add one to start tracking progress."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {project.goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  canManage={canManage}
                  onEdit={(g) => {
                    setEditingGoal(g);
                    setGoalFormOpen(true);
                  }}
                  onDelete={setDeleteGoalTarget}
                />
              ))}
            </div>
          )}
        </section>

        {/* Tasks */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-text-faint">
              Tasks
            </h2>
            <Button
              variant="ghost"
              onClick={() => {
                setEditingTask(null);
                setTaskFormOpen(true);
              }}
            >
              + Add task
            </Button>
          </div>

          {project.tasks.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-text-soft">
              No tasks yet.
            </p>
          ) : (
            <div className="rounded-card border border-line bg-card px-4">
              {project.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  goal={task.goalId ? goalById[task.goalId] : null}
                  onCycleStatus={handleCycleStatus}
                  canDelete={canManage}
                  onEdit={(t) => {
                    setEditingTask(t);
                    setTaskFormOpen(true);
                  }}
                  onDelete={setDeleteTaskTarget}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <ProjectFormModal
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        onSubmit={handleProjectSubmit}
        initial={project}
      />
      <ProjectAccessModal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        projectId={id}
        projectName={project.name}
      />
      <ConfirmModal
        open={deleteProjectOpen}
        title="Delete project?"
        message={`This will permanently delete "${project.name}" along with all of its goals and tasks.`}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteProjectOpen(false)}
        busy={deletingProject}
      />

      <GoalFormModal
        open={goalFormOpen}
        onClose={() => setGoalFormOpen(false)}
        onSubmit={handleGoalSubmit}
        initial={editingGoal}
      />
      <TaskFormModal
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSubmit={handleTaskSubmit}
        initial={editingTask}
        goals={project.goals}
      />

      <ConfirmModal
        open={!!deleteGoalTarget}
        title="Delete goal?"
        message={`This will permanently delete "${deleteGoalTarget?.label}". Linked tasks will be unlinked, not deleted.`}
        onConfirm={handleDeleteGoal}
        onCancel={() => setDeleteGoalTarget(null)}
        busy={busy}
      />
      <ConfirmModal
        open={!!deleteTaskTarget}
        title="Delete task?"
        message={`This will permanently delete "${deleteTaskTarget?.title}".`}
        onConfirm={handleDeleteTask}
        onCancel={() => setDeleteTaskTarget(null)}
        busy={busy}
      />
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <AuthGuard>
      <ProjectDetail />
    </AuthGuard>
  );
}
