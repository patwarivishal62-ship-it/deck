const express = require("express");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const { requireAuth } = require("../middleware/auth");
const { STATUSES } = require("../constants");

const router = express.Router();
router.use(requireAuth);

function ownedProject(projectId, userId) {
  return projectsDb.findByIdForUser(projectId, userId);
}

// When a task's status flips to/from "done", nudge its linked goal's currentValue
// by the goal's step — mirrors the original app's applyTaskStatusChange().
function syncGoalOnStatusChange(goalId, oldStatus, newStatus) {
  if (!goalId) return;
  const wasDone = oldStatus === "done";
  const isDone = newStatus === "done";
  if (wasDone === isDone) return;

  const goal = goalsDb.findById(goalId);
  if (!goal) return;
  const step = Number(goal.step) || 1;
  const nextValue = isDone ? goal.currentValue + step : Math.max(0, goal.currentValue - step);
  goalsDb.setCurrentValue(goalId, nextValue);
}

router.post("/:projectId/tasks", (req, res) => {
  const project = ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { title, notes, goalId, status, dueDate } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  const finalStatus = STATUSES.includes(status) ? status : "todo";

  if (goalId) {
    const goal = goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  const task = tasksDb.create({
    projectId: project.id,
    title: title.trim(),
    notes: (notes || "").trim(),
    goalId: goalId || null,
    status: finalStatus,
    dueDate: dueDate || null,
    completedAt: finalStatus === "done" ? new Date().toISOString() : null,
  });

  if (finalStatus === "done" && goalId) {
    syncGoalOnStatusChange(goalId, "todo", "done");
  }

  res.status(201).json({ task });
});

router.patch("/:projectId/tasks/:taskId", (req, res) => {
  const project = ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const { title, notes, goalId, status, dueDate } = req.body || {};
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "Task title is required." });
  }
  if (goalId) {
    const goal = goalsDb.findByIdInProject(goalId, project.id);
    if (!goal) return res.status(400).json({ error: "Linked goal not found in this project." });
  }

  const oldStatus = task.status;
  const newStatus = status !== undefined ? (STATUSES.includes(status) ? status : task.status) : task.status;

  const updated = tasksDb.update(task.id, {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(notes !== undefined ? { notes: notes.trim() } : {}),
    ...(goalId !== undefined ? { goalId: goalId || null } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate || null } : {}),
    status: newStatus,
    completedAt: newStatus === "done" ? task.completedAt || new Date().toISOString() : null,
  });

  if (oldStatus !== newStatus) {
    syncGoalOnStatusChange(updated.goalId, oldStatus, newStatus);
  }

  res.json({ task: updated });
});

// PATCH /api/projects/:projectId/tasks/:taskId/cycle-status
// Powers the click-to-cycle status button: todo -> in_progress -> done -> todo
router.patch("/:projectId/tasks/:taskId/cycle-status", (req, res) => {
  const project = ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const idx = STATUSES.indexOf(task.status);
  const newStatus = STATUSES[(idx + 1) % STATUSES.length];

  const updated = tasksDb.update(task.id, {
    status: newStatus,
    completedAt: newStatus === "done" ? new Date().toISOString() : null,
  });

  syncGoalOnStatusChange(task.goalId, task.status, newStatus);
  res.json({ task: updated });
});

router.delete("/:projectId/tasks/:taskId", (req, res) => {
  const project = ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const task = tasksDb.findByIdInProject(req.params.taskId, project.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  tasksDb.remove(task.id);
  res.json({ ok: true });
});

module.exports = router;
