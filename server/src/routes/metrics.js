const express = require("express");
const projectsDb = require("../db/projects");
const metricsDb = require("../db/metrics");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
const activityLogDb = require("../db/activityLog");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { CATEGORY_KEYS } = require("../constants");

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

// Metrics can be viewed by anyone with project access, but only created,
// edited, deleted, or logged by a workspace Admin/Owner — same rule as
// goals and milestones, since these are all measurement/planning
// artifacts rather than day-to-day task work.
function requireMetricManager(req, res, project) {
  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    res.status(403).json({ error: "Only workspace admins or owners can manage metrics." });
    return false;
  }
  return true;
}

router.get("/:projectId/metrics", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const metrics = await metricsDb.listByProject(project.id);
  res.json({ metrics });
});

router.post("/:projectId/metrics", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMetricManager(req, res, project)) return;

  const { category, key, label, unit } = req.body || {};
  if (!label || !label.trim()) {
    return res.status(400).json({ error: "Metric name is required." });
  }
  if (!CATEGORY_KEYS.includes(category)) {
    return res.status(400).json({ error: "Invalid category." });
  }

  const metric = await metricsDb.create({
    projectId: project.id,
    createdBy: req.userId,
    category,
    key: key || null,
    label: label.trim(),
    unit: unit || "count",
  });

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "metric_created",
    message: `${actor?.name || actor?.email} started tracking "${metric.label}"`,
  });

  res.status(201).json({ metric });
});

router.patch("/:projectId/metrics/:metricId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMetricManager(req, res, project)) return;

  const metric = await metricsDb.findByIdInProject(req.params.metricId, project.id);
  if (!metric) return res.status(404).json({ error: "Metric not found." });

  const { label, unit } = req.body || {};
  if (label !== undefined && !label.trim()) {
    return res.status(400).json({ error: "Metric name is required." });
  }

  const updated = await metricsDb.update(metric.id, {
    ...(label !== undefined ? { label: label.trim() } : {}),
    ...(unit !== undefined ? { unit } : {}),
  });
  res.json({ metric: updated });
});

router.delete("/:projectId/metrics/:metricId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMetricManager(req, res, project)) return;

  const metric = await metricsDb.findByIdInProject(req.params.metricId, project.id);
  if (!metric) return res.status(404).json({ error: "Metric not found." });

  await metricsDb.remove(metric.id);
  res.json({ ok: true });
});

// POST /api/projects/:projectId/metrics/:metricId/entries  { date, value, note }
router.post("/:projectId/metrics/:metricId/entries", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMetricManager(req, res, project)) return;

  const metric = await metricsDb.findByIdInProject(req.params.metricId, project.id);
  if (!metric) return res.status(404).json({ error: "Metric not found." });

  const { date, value, note } = req.body || {};
  if (!date) return res.status(400).json({ error: "Date is required." });
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return res.status(400).json({ error: "A numeric value is required." });
  }

  const updated = await metricsDb.addEntry(metric.id, {
    date,
    value: Number(value),
    note: (note || "").trim(),
    loggedBy: req.userId,
  });
  res.status(201).json({ metric: updated });
});

router.delete("/:projectId/metrics/:metricId/entries/:entryId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMetricManager(req, res, project)) return;

  const metric = await metricsDb.findByIdInProject(req.params.metricId, project.id);
  if (!metric) return res.status(404).json({ error: "Metric not found." });

  const updated = await metricsDb.removeEntry(metric.id, req.params.entryId);
  res.json({ metric: updated });
});

module.exports = router;
