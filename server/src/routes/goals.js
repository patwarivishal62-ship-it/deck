const express = require("express");
const projectsDb = require("../db/projects");
const goalsDb = require("../db/goals");
const tasksDb = require("../db/tasks");
const { requireAuth } = require("../middleware/auth");
const { CATEGORY_KEYS, PERIODS } = require("../constants");

const router = express.Router();
router.use(requireAuth);

async function ownedProject(projectId, userId) {
  return projectsDb.findByIdForUser(projectId, userId);
}

router.post("/:projectId/goals", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

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
  res.status(201).json({ goal });
});

router.patch("/:projectId/goals/:goalId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

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

// PATCH /api/projects/:projectId/goals/:goalId/nudge  { direction: "inc" | "dec" }
// Powers the +/- stepper buttons on the goal card.
router.patch("/:projectId/goals/:goalId/nudge", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const goal = await goalsDb.findByIdInProject(req.params.goalId, project.id);
  if (!goal) return res.status(404).json({ error: "Goal not found." });

  const { direction } = req.body || {};
  const step = Number(goal.step) || 1;
  const nextValue =
    direction === "inc" ? goal.currentValue + step : Math.max(0, goal.currentValue - step);

  const updated = await goalsDb.setCurrentValue(goal.id, nextValue);
  res.json({ goal: updated });
});

router.delete("/:projectId/goals/:goalId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const goal = await goalsDb.findByIdInProject(req.params.goalId, project.id);
  if (!goal) return res.status(404).json({ error: "Goal not found." });

  // Tasks linked to this goal stay, but unlink so they stop counting toward it.
  await tasksDb.unlinkGoal(goal.id);
  await goalsDb.remove(goal.id);
  res.json({ ok: true });
});

module.exports = router;
