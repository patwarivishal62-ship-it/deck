const express = require("express");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
const activityLogDb = require("../db/activityLog");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { CATEGORY_KEYS, PERIODS } = require("../constants");

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

// Goals can be viewed by anyone with project access, but only created,
// edited, or deleted by a workspace Admin/Owner — Members can see progress
// but not change what's being measured. There's deliberately no "nudge"
// endpoint: the only way a goal's currentValue moves is by completing an
// actual linked task (see routes/tasks.js), so every unit of progress
// traces back to a real, accountable record instead of an arbitrary click.
function requireGoalManager(req, res, project) {
  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    res.status(403).json({ error: "Only workspace admins or owners can manage goals." });
    return false;
  }
  return true;
}

router.post("/:projectId/goals", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireGoalManager(req, res, project)) return;

  const { category, platform, label, targetValue, currentValue, unit, period, step } = req.body || {};
  if (!label || !label.trim()) {
    return res.status(400).json({ error: "Goal label is required." });
  }

  const goal = await goalsDb.create({
    projectId: project.id,
    category: CATEGORY_KEYS.includes(category) ? category : "other",
    platform: (platform || "").trim(),
    label: label.trim(),
    targetValue: Number(targetValue) || 0,
    currentValue: Number(currentValue) || 0,
    unit: (unit || "").trim(),
    period: PERIODS.includes(period) ? period : "monthly",
    step: Number(step) || 1,
  });

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "goal_created",
    message: `${actor?.name || actor?.email} added the goal "${goal.label}"`,
  });

  res.status(201).json({ goal });
});

router.patch("/:projectId/goals/:goalId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireGoalManager(req, res, project)) return;

  const goal = await goalsDb.findByIdInProject(req.params.goalId, project.id);
  if (!goal) return res.status(404).json({ error: "Goal not found." });

  const { category, platform, label, targetValue, currentValue, unit, period, step } = req.body || {};
  if (label !== undefined && !label.trim()) {
    return res.status(400).json({ error: "Goal label is required." });
  }

  const updated = await goalsDb.update(goal.id, {
    ...(category !== undefined ? { category: CATEGORY_KEYS.includes(category) ? category : "other" } : {}),
    ...(platform !== undefined ? { platform: platform.trim() } : {}),
    ...(label !== undefined ? { label: label.trim() } : {}),
    ...(targetValue !== undefined ? { targetValue: Number(targetValue) || 0 } : {}),
    ...(currentValue !== undefined ? { currentValue: Number(currentValue) || 0 } : {}),
    ...(unit !== undefined ? { unit: unit.trim() } : {}),
    ...(period !== undefined ? { period: PERIODS.includes(period) ? period : "monthly" } : {}),
    ...(step !== undefined ? { step: Number(step) || 1 } : {}),
  });
  res.json({ goal: updated });
});

router.delete("/:projectId/goals/:goalId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireGoalManager(req, res, project)) return;

  const goal = await goalsDb.findByIdInProject(req.params.goalId, project.id);
  if (!goal) return res.status(404).json({ error: "Goal not found." });

  // Tasks linked to this goal stay, but unlink so they stop counting toward it.
  await tasksDb.unlinkGoal(goal.id);
  await goalsDb.remove(goal.id);

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "goal_deleted",
    message: `${actor?.name || actor?.email} deleted the goal "${goal.label}"`,
  });

  res.json({ ok: true });
});

module.exports = router;
