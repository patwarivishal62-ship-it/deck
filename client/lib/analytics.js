// Pure analytics helpers — every number on the Analytics and Reports pages is
// derived here from real project data (projects with their goals/tasks/
// milestones as returned by GET /api/projects). No invented values.

import { CATEGORIES } from "./constants.js";
import { getProjectStatus } from "./projectStatus.js";
import { projectCategoryKey, projectProgress, todayISO } from "./dashboard.js";

export function taskCompletedDate(task) {
  return (task.completedAt || "").slice(0, 10) || null;
}

// Full analytics model for a set of projects.
export function computeAnalytics(projects) {
  const list = projects || [];
  const today = todayISO();

  const rows = list.map((project) => {
    const tasks = project.tasks || [];
    const goals = project.goals || [];
    const doneTasks = tasks.filter((t) => t.status === "done").length;
    const overdueTasks = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length;
    return {
      project,
      status: getProjectStatus(project),
      progress: projectProgress(project),
      tasksTotal: tasks.length,
      tasksDone: doneTasks,
      tasksOpen: tasks.length - doneTasks,
      overdueTasks,
      goalsTotal: goals.length,
      dueDate: project.dueDate || null,
      overdueProject: !project.archived && project.dueDate && project.dueDate < today,
      categoryKey: projectCategoryKey(project),
      createdAt: project.createdAt || null,
      allTasks: tasks,
    };
  });

  const byStatus = { completed: 0, in_progress: 0, pending: 0 };
  rows.forEach((r) => {
    byStatus[r.status] += 1;
  });

  const allTasks = rows.flatMap((r) => r.allTasks);
  const tasksByStatus = {
    done: allTasks.filter((t) => t.status === "done").length,
    in_progress: allTasks.filter((t) => t.status === "in_progress").length,
    todo: allTasks.filter((t) => t.status === "todo").length,
  };

  const byCategory = {};
  Object.keys(CATEGORIES).forEach((key) => {
    byCategory[key] = { ...CATEGORIES[key], key, projects: 0, goals: 0 };
  });
  rows.forEach((r) => {
    if (r.categoryKey && byCategory[r.categoryKey]) byCategory[r.categoryKey].projects += 1;
    (r.project.goals || []).forEach((g) => {
      if (byCategory[g.category]) byCategory[g.category].goals += 1;
    });
  });

  const doneProgressRows = rows.filter((r) => r.tasksTotal > 0);
  const avgCompletion = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.progress, 0) / rows.length)
    : 0;
  const avgTaskCompletion = allTasks.length
    ? Math.round((tasksByStatus.done / allTasks.length) * 100)
    : 0;

  return {
    total: rows.length,
    byStatus,
    tasksByStatus,
    tasksTotal: allTasks.length,
    tasksDone: tasksByStatus.done,
    tasksOverdue: rows.reduce((sum, r) => sum + r.overdueTasks, 0),
    overdueProjects: rows.filter((r) => r.overdueProject).length,
    byCategory,
    avgCompletion,
    avgTaskCompletion,
    rows,
  };
}

// Tasks completed per ISO week over the trailing `weeks` weeks (oldest →
// newest). Weeks start Monday; buckets with zero completions are kept so the
// chart shows real gaps.
export function weeklyCompletions(projects, weeks = 8) {
  const allTasks = (projects || []).flatMap((p) => p.tasks || []);
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: 0,
    });
  }

  for (const task of allTasks) {
    const done = taskCompletedDate(task);
    if (!done) continue;
    const date = new Date(`${done}T00:00:00`);
    for (let i = 0; i < buckets.length; i++) {
      if (date >= buckets[i].start && date < buckets[i].end) {
        buckets[i].count += 1;
        break;
      }
    }
  }
  return buckets;
}

// Donut chart segments for status distribution, in a stable order.
export function statusSegments(analytics) {
  return [
    { key: "completed", label: "Completed", value: analytics.byStatus.completed, color: "#12B76A" },
    { key: "in_progress", label: "In progress", value: analytics.byStatus.in_progress, color: "#7C5CFF" },
    { key: "pending", label: "Pending", value: analytics.byStatus.pending, color: "#C9D3E0" },
  ].filter((s) => s.value > 0);
}
