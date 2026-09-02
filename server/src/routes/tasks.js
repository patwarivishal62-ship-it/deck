const express = require("express");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
const activityLogDb = require("../db/activityLog");
const notificationsDb = require("../db/notifications");
const { collaboratorsFor } = require("../lib/collaborators");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { STATUSES, PRIORITY_KEYS } = require("../constants");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

async function ownedProject(projectId, req) {
  return projectsDb.findByIdForCaller(projectId, {
    fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
    restrictedWorkspaceIds: req.restrictedWorkspaceIds,
    userId: req.userId,
  });
}

function roleFor(req, workspaceId) {
  return req.workspaces.find((w) => w.id === workspaceId)?.role;
}

// Bare YYYY-MM-DD, so lexical comparison against dueDate strings (same
// format) works directly for chronological ordering.
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// When a task's status flips to/from "done", nudge its linked goal's currentValue
// by the goal's step — mirrors the original app's applyTaskStatusChange().
async function syncGoalOnStatusChange(goalId, oldStatus, newStatus) {
  if (!goalId) return;
  const wasDone = oldStatus === "done";
  const isDone = newStatus === "done";
  if (wasDone === isDone) return;

  const goal = await goalsDb.findById(goalId);
  if (!goal) return;
  const step = Number(goal.step) || 1;
  const nextValue = isDone ? goal.currentValue + step : Math.max(0, goal.currentValue - step);
  await goalsDb.setCurrentValue(goalId, nextValue);
}

// Only logs the "completed" moment, not every status change, to keep the
// timeline meaningful rather than noisy with todo<->in_progress churn.
async function logIfCompleted(req, project, task, oldStatus, newStatus) {
  if (oldStatus === "done" || newStatus !== "done") return;
  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "task_completed",
    message: `${actor?.name || actor?.email} completed "${task.title}"`,
  });
}

// Validates assigneeId (if present) against who can actually see this
// project, and — only when it's a genuinely NEW assignment, not a re-save
// of the same value, and not someone assigning it to themselves — notifies
// the new assignee.
async function resolveAssignee(req, project, assigneeId, previousAssigneeId) {
  if (!assigneeId) return { assigneeId: null, notify: null };

  const collaborators = await collaboratorsFor(project);
  if (!collaborators.some((c) => c.userId === assigneeId)) {
    const err = new Error("That person doesn't have access to this project.");
    err.status = 400;
    throw err;
  }

  const isNewAssignment = assigneeId !== previousAssigneeId;
  const notify = isNewAssignment && assigneeId !== req.userId ? assigneeId : null;
  return { assigneeId, notify };
}

async function notifyAssignee(project, task, assigneeUserId, actorUserId) {
  if (!assigneeUserId) return;
  const actor = await usersDb.findById(actorUserId);
  await notificationsDb.create({
    userId: assigneeUserId,
    workspaceId: project.workspaceId,
    projectId: project.id,
    type: "task_assigned",
    message: `${actor?.name || actor?.email} assigned you "${task.title}" in ${project.name}`,
    link: `/projects/${project.id}`,
  });
}

router.post("/:projectId/tasks", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { title, notes, goalId, status, dueDate, assigneeId, priority } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  // Same enum + validation rule as projects (routes/projects.js).
  if (priority !== undefined && priority !== "" && !PRIORITY_KEYS.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }
  const finalStatus = STATUSES.includes(status) ? status : "todo";

  // A task can be scheduled for today or any future date, kept ready as a
  // "to do" — but not backdated, since that would let progress get recorded
  // as if it happened before it actually did.
  if (dueDate && dueDate < todayISODate()) {
    return res.status(400).json({ error: "Due date can't be in the past." });
  }

  if (goalId) {
    const goal = await goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  let assignee;
  try {
    assignee = await resolveAssignee(req, project, assigneeId, null);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const task = await tasksDb.create({
    projectId: project.id,
    title: title.trim(),
    notes: (notes || "").trim(),
    goalId: goalId || null,
    status: finalStatus,
    dueDate: dueDate || null,
    completedAt: finalStatus === "done" ? new Date().toISOString() : null,
    assigneeId: assignee.assigneeId,
    priority: priority || "medium",
  });

  if (finalStatus === "done" && goalId) {
    await syncGoalOnStatusChange(goalId, "todo", "done");
  }

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "task_created",
    message: `${actor?.name || actor?.email} added the task "${task.title}"`,
  });
  await logIfCompleted(req, project, task, "todo", finalStatus);
  await notifyAssignee(project, task, assignee.notify, req.userId);

  res.status(201).json({ task });
});

router.patch("/:projectId/tasks/:taskId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = await tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const { title, notes, goalId, status, dueDate, assigneeId, priority } = req.body || {};
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  if (priority !== undefined && priority !== "" && !PRIORITY_KEYS.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }
  // Only validate when the due date is actually being changed to something
  // new — an existing task that's already overdue (because time passed,
  // not because someone backdated it) should still be freely editable.
  if (dueDate && dueDate !== task.dueDate && dueDate < todayISODate()) {
    return res.status(400).json({ error: "Due date can't be in the past." });
  }
  if (goalId) {
    const goal = await goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  let assignee = { assigneeId: task.assigneeId, notify: null };
  if (assigneeId !== undefined) {
    try {
      assignee = await resolveAssignee(req, project, assigneeId, task.assigneeId);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
  }

  const oldStatus = task.status;
  const newStatus = status !== undefined ? (STATUSES.includes(status) ? status : task.status) : task.status;

  const updated = await tasksDb.update(task.id, {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(notes !== undefined ? { notes: notes.trim() } : {}),
    ...(goalId !== undefined ? { goalId: goalId || null } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate || null } : {}),
    ...(assigneeId !== undefined ? { assigneeId: assignee.assigneeId } : {}),
    ...(priority !== undefined && priority !== "" ? { priority } : {}),
    status: newStatus,
    completedAt: newStatus === "done" ? task.completedAt || new Date().toISOString() : null,
  });

  if (oldStatus !== newStatus) {
    await syncGoalOnStatusChange(updated.goalId, oldStatus, newStatus);
  }
  await logIfCompleted(req, project, updated, oldStatus, newStatus);
  await notifyAssignee(project, updated, assignee.notify, req.userId);

  res.json({ task: updated });
});

// PATCH /api/projects/:projectId/tasks/:taskId/cycle-status
// Powers the click-to-cycle status button: todo -> in_progress -> done -> todo
router.patch("/:projectId/tasks/:taskId/cycle-status", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = await tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const idx = STATUSES.indexOf(task.status);
  const newStatus = STATUSES[(idx + 1) % STATUSES.length];

  const updated = await tasksDb.update(task.id, {
    status: newStatus,
    completedAt: newStatus === "done" ? new Date().toISOString() : null,
  });

  await syncGoalOnStatusChange(task.goalId, task.status, newStatus);
  await logIfCompleted(req, project, updated, task.status, newStatus);
  res.json({ task: updated });
});

// Deleting a task is Admin/Owner only (Members can create and update tasks,
// per the "add tasks and update them" rule, but not remove them) — matches
// how project deletion is already gated.
router.delete("/:projectId/tasks/:taskId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can delete tasks." });
  }

  const task = await tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  await tasksDb.remove(task.id);

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "task_deleted",
    message: `${actor?.name || actor?.email} deleted the task "${task.title}"`,
  });

  res.json({ ok: true });
});

module.exports = router;
