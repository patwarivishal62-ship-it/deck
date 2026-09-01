const express = require("express");
const projectsDb = require("../db/projects");
const milestonesDb = require("../db/milestones");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
const activityLogDb = require("../db/activityLog");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");

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

// Milestones can be viewed by anyone with project access, but only created,
// edited, or deleted by a workspace Admin/Owner — same rule as goals, since
// both are project-planning artifacts rather than day-to-day task work.
function requireMilestoneManager(req, res, project) {
  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    res.status(403).json({ error: "Only workspace admins or owners can manage milestones." });
    return false;
  }
  return true;
}

router.get("/:projectId/milestones", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const milestones = await milestonesDb.listByProject(project.id);
  res.json({ milestones });
});

router.post("/:projectId/milestones", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMilestoneManager(req, res, project)) return;

  const { title, date, notes } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Milestone title is required." });
  }
  if (!date) {
    return res.status(400).json({ error: "Milestone date is required." });
  }

  const milestone = await milestonesDb.create({
    projectId: project.id,
    createdBy: req.userId,
    title: title.trim(),
    date,
    notes: (notes || "").trim(),
  });

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "milestone_created",
    message: `${actor?.name || actor?.email} added the milestone "${milestone.title}"`,
  });

  res.status(201).json({ milestone });
});

router.patch("/:projectId/milestones/:milestoneId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMilestoneManager(req, res, project)) return;

  const milestone = await milestonesDb.findByIdInProject(req.params.milestoneId, project.id);
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  const { title, date, notes } = req.body || {};
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "Milestone title is required." });
  }
  if (date !== undefined && !date) {
    return res.status(400).json({ error: "Milestone date is required." });
  }

  const updated = await milestonesDb.update(milestone.id, {
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(notes !== undefined ? { notes: notes.trim() } : {}),
  });
  res.json({ milestone: updated });
});

router.delete("/:projectId/milestones/:milestoneId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });
  if (!requireMilestoneManager(req, res, project)) return;

  const milestone = await milestonesDb.findByIdInProject(req.params.milestoneId, project.id);
  if (!milestone) return res.status(404).json({ error: "Milestone not found." });

  await milestonesDb.remove(milestone.id);

  const actor = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "milestone_deleted",
    message: `${actor?.name || actor?.email} deleted the milestone "${milestone.title}"`,
  });

  res.json({ ok: true });
});

module.exports = router;
