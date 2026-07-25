// Projects don't have a stored status field — it's derived from their tasks,
// since that's the data that actually exists. Kept in one place so the
// dashboard stat cards and any per-project badge agree on the same rule.
export function getProjectStatus(project) {
  const tasks = project.tasks || [];
  if (tasks.length === 0) return "pending";

  const doneCount = tasks.filter((t) => t.status === "done").length;
  if (doneCount === tasks.length) return "completed";

  const startedCount = tasks.filter((t) => t.status !== "todo").length;
  if (startedCount > 0) return "in_progress";

  return "pending";
}

export function summarizeProjectStatuses(projects) {
  const summary = { total: projects.length, completed: 0, in_progress: 0, pending: 0 };
  projects.forEach((project) => {
    summary[getProjectStatus(project)] += 1;
  });
  return summary;
}
