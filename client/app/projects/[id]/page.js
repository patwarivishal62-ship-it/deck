"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import GoalCard from "@/components/GoalCard";
import TaskRow from "@/components/TaskRow";
import GoalFormModal from "@/components/GoalFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/FormControls";
import Meter from "@/components/Meter";
import { api } from "@/lib/api";

function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function handleNudge(goal, direction) {
    try {
      const data = await api.nudgeGoal(id, goal.id, direction);
      setProject((p) => ({ ...p, goals: p.goals.map((g) => (g.id === data.goal.id ? data.goal : g)) }));
    } catch (err) {
      setError(err.message);
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

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-text-soft hover:text-signal-deep">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All projects
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-text-soft">{project.description}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditingGoal(null);
                setGoalFormOpen(true);
              }}
            >
              Edit project
            </Button>
            <Button variant="destructive">Delete</Button>
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
            <Button
              variant="ghost"
              onClick={() => {
                setEditingGoal(null);
                setGoalFormOpen(true);
              }}
            >
              + Add goal
            </Button>
          </div>

          {project.goals.length === 0 ? (
            <p className="rounded-card border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-text-soft">
              No goals yet. Add one to start tracking progress.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {project.goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onNudge={handleNudge}
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
