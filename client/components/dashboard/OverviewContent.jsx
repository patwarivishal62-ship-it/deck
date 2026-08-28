"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { getProjectStatus } from "@/lib/projectStatus";
import { CATEGORIES } from "@/lib/constants";
import Greeting from "./Greeting";
import StatCard from "./StatCard";
import OverviewProjectCard from "./OverviewProjectCard";
import TaskItem from "./TaskItem";

function pad(n) {
  return String(n).padStart(2, "0");
}

function localISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dueLabel(iso) {
  if (!iso) return "No due date";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Same formula the project detail page uses: average of each goal's
// currentValue/targetValue (capped at 100% per goal). Falls back to task
// completion for projects that don't have goals yet.
function projectProgress(p) {
  const goals = p.goals || [];
  if (goals.length > 0) {
    const sum = goals.reduce(
      (acc, g) => acc + (g.targetValue > 0 ? Math.min(1, (g.currentValue || 0) / g.targetValue) : 0),
      0
    );
    return Math.round((sum / goals.length) * 100);
  }
  const tasks = p.tasks || [];
  if (tasks.length > 0) {
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }
  return 0;
}

const STATUS_META = {
  completed: { label: "Completed", tone: "good" },
  in_progress: { label: "On Track", tone: "good" },
  pending: { label: "Pending", tone: "faint" },
};

// The home/overview page, powered by the real project data — the same design
// shell as the mock that shipped in PR #11, but every number, project, and
// task comes from the API. Signed-out visitors are redirected to /login
// (the behavior the README documents for the home page).
export default function OverviewContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState(null); // null = not loaded yet
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    api
      .listProjects({ archived: false })
      .then((data) => {
        if (!active) return;
        setProjects(data.projects);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const today = localISODate(new Date());

  const derived = useMemo(() => {
    const active = projects || [];
    const allTasks = active.flatMap((p) => p.tasks || []);
    const doneTasks = allTasks.filter((t) => t.status === "done");
    const pct = allTasks.length ? Math.round((doneTasks.length / allTasks.length) * 100) : 0;

    const summary = { total: active.length, completed: 0, in_progress: 0, pending: 0 };
    active.forEach((p) => {
      summary[getProjectStatus(p)] += 1;
    });

    // Most time-sensitive first: nearest due date, then newest.
    const sorted = [...active].sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const top = sorted.slice(0, 3);

    // Open tasks due today (or overdue) across everything the user can see.
    const todays = [];
    active.forEach((p) =>
      (p.tasks || []).forEach((t) => {
        if (t.status !== "done" && t.dueDate && t.dueDate <= today) {
          todays.push({ id: t.id, title: t.title, done: false, pill: p.name, projectId: p.id });
        }
      })
    );
    todays.sort((a, b) => a.title.localeCompare(b.title));

    return { allTasks, doneTasks, pct, summary, top, todays: todays.slice(0, 5) };
  }, [projects, today]);

  async function toggleTask(task) {
    if (togglingId === task.id) return;
    setTogglingId(task.id);
    try {
      const data = await api.cycleTaskStatus(task.projectId, task.id);
      setProjects((prev) =>
        prev
          ? prev.map((p) =>
              p.id === task.projectId
                ? { ...p, tasks: (p.tasks || []).map((t) => (t.id === data.task.id ? data.task : t)) }
                : p
            )
          : prev
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  if (authLoading || !user) {
    return (
      <p className="mt-10 font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
    );
  }

  return (
    <>
      <Greeting name={user?.name} />

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Projects"
          value={derived.summary.total}
          trend={`${derived.summary.completed} completed`}
        />
        <StatCard
          label="Tasks Completed"
          value={`${derived.pct}%`}
          trend={`${derived.doneTasks.length} of ${derived.allTasks.length} done`}
        />
        <StatCard
          label="On Track"
          value={derived.summary.in_progress + derived.summary.completed}
          trend={`${derived.summary.pending} pending`}
        />
      </section>

      {error && <p className="mt-4 text-sm text-signal-deep">{error}</p>}

      {projects === null ? (
        <p className="mt-8 font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
      ) : (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#172033]">Projects</h2>
              <Link
                href="/projects"
                className="text-[12px] font-medium text-[#5146F5] transition-opacity duration-150 hover:opacity-80"
              >
                View all
              </Link>
            </div>
            {derived.top.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#E8EAF0] bg-white px-4 py-8 text-center">
                <p className="text-sm text-[#7B8498]">No projects yet.</p>
                <Link
                  href="/projects"
                  className="mt-2 inline-block text-[12px] font-medium text-[#5146F5] hover:opacity-80"
                >
                  Create your first project
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {derived.top.map((p) => {
                  const status = STATUS_META[getProjectStatus(p)];
                  const category = (p.goals || []).map((g) => g.category).find((c) => c && CATEGORIES[c]);
                  return (
                    <OverviewProjectCard
                      key={p.id}
                      project={{
                        id: p.id,
                        title: p.name,
                        statusLabel: status.label,
                        tone: status.tone,
                        progress: projectProgress(p),
                        taskCount: (p.tasks || []).length,
                        dueLabel: dueLabel(p.dueDate),
                        workspaceName: p.workspaceName || "",
                        category: category || "other",
                        color: category ? CATEGORIES[category].color : "#5146F5",
                      }}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-6 pb-2">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#172033]">Due today</h2>
              <Link
                href="/projects"
                className="text-[12px] font-medium text-[#5146F5] transition-opacity duration-150 hover:opacity-80"
              >
                View all
              </Link>
            </div>
            {derived.todays.length === 0 ? (
              <p className="py-2 text-[13px] text-[#7B8498]">Nothing due today — enjoy the calm.</p>
            ) : (
              <ul className="divide-y divide-[#F0F1F6]">
                {derived.todays.map((t) => (
                  <TaskItem key={t.id} task={t} onToggle={() => toggleTask(t)} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
