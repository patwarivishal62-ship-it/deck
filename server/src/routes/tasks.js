const express = require("express");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const membershipsDb = require("../db/memberships");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { STATUSES } = require("../constants");

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

router.post("/:projectId/tasks", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { title, notes, goalId, status, dueDate } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  const finalStatus = STATUSES.includes(status) ? status : "todo";

  if (goalId) {
    const goal = await goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  const task = await tasksDb.create({
    projectId: project.id,
    title: title.trim(),
    notes: (notes || "").trim(),
    goalId: goalId || null,
    status: finalStatus,
    dueDate: dueDate || null,
    completedAt: finalStatus === "done" ? new Date().toISOString() : null,
  });

  if (finalStatus === "done" && goalId) {
    await syncGoalOnStatusChange(goalId, "todo", "done");
  }

  res.status(201).json({ task });
});

router.patch("/:projectId/tasks/:taskId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = await tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const { title, notes, goalId, status, dueDate } = req.body || {};
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  if (goalId) {
    const goal = await goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  const oldStatus = task.status;
  const newStatus = status !== undefined ? (STATUSES.includes(status) ? status : task.status) : task.status;

  const updated = await tasksDb.update(task.id, {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(notes !== undefined ? { notes: notes.trim() } : {}),
    ...(goalId !== undefined ? { goalId: goalId || null } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate || null } : {}),
    status: newStatus,
    completedAt: newStatus === "done" ? task.completedAt || new Date().toISOString() : null,
  });

  if (oldStatus !== newStatus) {
    await syncGoalOnStatusChange(updated.goalId, oldStatus, newStatus);
  }

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
  res.json({ ok: true });
});

module.exports = router;
