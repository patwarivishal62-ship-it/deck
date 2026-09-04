// Helpers for the post-login Overview dashboard (/dashboard).
// Everything here derives display data from real app data (projects, goals,
// tasks, session user) — no invented numbers anywhere.

import { CATEGORIES } from "./constants.js";

// Bare YYYY-MM-DD in the user's local time — matches the format the API
// stores on task/project dueDate fields (same convention as the server's
// todayISODate()).
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function partOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// "Vishal Kumar" → "Vishal", falls back to the email handle, then "".
export function firstNameFor(user) {
  if (!user) return "";
  const source = (user.name || user.email || "").trim();
  const first = source.split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// Project progress: average goal completion when goals exist (same rule as
// ProjectCard), otherwise task completion, otherwise 0.
export function projectProgress(project) {
  const goals = project?.goals || [];
  const tasks = project?.tasks || [];
  if (goals.length > 0) {
    const avg =
      goals.reduce(
        (sum, g) => sum + (g.targetValue > 0 ? Math.min(1, (g.currentValue || 0) / g.targetValue) : 0),
        0
      ) / goals.length;
    return Math.round(avg * 100);
  }
  if (tasks.length > 0) {
    return Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);
  }
  return 0;
}

// A project inherits its first categorized goal's channel for the icon
// container color/icon; falls back to null (neutral folder).
export function projectCategoryKey(project) {
  const goal = (project?.goals || []).find((g) => g && CATEGORIES[g.category]);
  return goal ? goal.category : null;
}

// "2026-03-14" → "Mar 14"
export function formatDueDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isOverdueDate(iso) {
  return Boolean(iso) && iso < todayISO();
}

// Tasks due today (open) + tasks completed today, each tagged with its
// project for the "related project" indicator.
export function collectTodayTasks(projects) {
  const today = todayISO();
  const withProject = (projects || []).flatMap((project) =>
    (project.tasks || []).map((task) => ({ ...task, project }))
  );
  const open = withProject.filter((t) => t.dueDate && t.dueDate <= today && t.status !== "done");
  const doneToday = withProject.filter(
    (t) => t.status === "done" && (t.completedAt || "").slice(0, 10) === today
  );
  // Overdue first, then today; completed-today sinks to the bottom.
  const byDue = (a, b) => (a.dueDate || today).localeCompare(b.dueDate || today);
  return [...open.sort(byDue), ...doneToday.sort(byDue)];
}
