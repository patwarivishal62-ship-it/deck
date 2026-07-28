const express = require("express");
const projectsDb = require("../db/projects");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
const activityLogDb = require("../db/activityLog");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { PRIORITY_KEYS, PROJECT_SORTS } = require("../constants");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function roleFor(req, workspaceId) {
  return req.workspaces.find((w) => w.id === workspaceId)?.role;
}

// The visibility rule every project query goes through: full access in
// owner/admin workspaces, restricted (creator or explicit grant) in
// workspaces where the caller is only a Member.
function accessFor(req) {
  return {
    fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
    restrictedWorkspaceIds: req.restrictedWorkspaceIds,
    userId: req.userId,
  };
}

// GET /api/projects — every project the caller can see, across every
// workspace they belong to (full visibility in owner/admin workspaces,
// restricted to created-or-granted projects in Member workspaces)
router.get("/", async (req, res) => {
  const { search, tags, priority, archived, sort } = req.query;

  let archivedOption = false;
  if (archived === "true") archivedOption = true;
  else if (archived === "all") archivedOption = "all";

  const projects = await projectsDb.listForCaller(accessFor(req), {
    search: search ? String(search).trim() : undefined,
    tags: parseTags(tags),
    priority: PRIORITY_KEYS.includes(priority) ? priority : undefined,
    archived: archivedOption,
    sort: PROJECT_SORTS.includes(sort) ? sort : "newest",
  });

  // Attach the caller's role in each project's workspace, and the workspace
  // name, so the client can show "shared in X" / gate the delete button.
  const withContext = projects.map((p) => {
    const workspace = req.workspaces.find((w) => w.id === p.workspaceId);
    return { ...p, workspaceName: workspace?.name, workspaceRole: workspace?.role };
  });

  res.json({ projects: withContext, workspaces: req.workspaces });
});

// POST /api/projects — create a project in a given workspace (defaults to
// the caller's personal workspace if omitted). If the caller is only a
// Member there, they're automatically granted access to their own creation.
router.post("/", async (req, res) => {
  const { name, description, tags, priority, dueDate } = req.body || {};
  let { workspaceId } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }
  if (priority !== undefined && priority !== "" && !PRIORITY_KEYS.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }

  if (!workspaceId) {
    workspaceId = req.workspaces.find((w) => w.personal)?.id;
  }
  const role = roleFor(req, workspaceId);
  if (!role) {
    return res.status(403).json({ error: "You don't have access to that workspace." });
  }

  const project = await projectsDb.create({
    workspaceId,
    userId: req.userId,
    name: name.trim(),
    description: (description || "").trim(),
    tags: parseTags(tags),
    priority: priority || "medium",
    dueDate: dueDate || null,
    memberAccess: role === "member" ? [req.userId] : [],
  });

  const creator = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "project_created",
    message: `${creator?.name || creator?.email} created this project`,
  });

  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  const project = await projectsDb.findByIdForCaller(req.params.id, accessFor(req));
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ project, role: roleFor(req, project.workspaceId) });
});

// PATCH /api/projects/:id — Admin/Owner only (Members can view a project's
// goals and manage its tasks, but can't edit the project itself)
router.patch("/:id", async (req, res) => {
  const existing = await projectsDb.findByIdForCaller(req.params.id, accessFor(req));
  if (!existing) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, existing.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can edit a project." });
  }

  const { name, description, tags, priority, dueDate, archived } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }
  if (priority !== undefined && priority !== "" && !PRIORITY_KEYS.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }

  const project = await projectsDb.update(req.params.id, {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(description !== undefined ? { description: description.trim() } : {}),
    ...(tags !== undefined ? { tags: parseTags(tags) } : {}),
    ...(priority !== undefined && priority !== "" ? { priority } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate || null } : {}),
    ...(archived !== undefined ? { archived: Boolean(archived) } : {}),
  });
  res.json({ project });
});

// DELETE /api/projects/:id — Admin/Owner only
router.delete("/:id", async (req, res) => {
  const existing = await projectsDb.findByIdForCaller(req.params.id, accessFor(req));
  if (!existing) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, existing.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can delete projects." });
  }

  await projectsDb.remove(req.params.id);
  res.json({ ok: true });
});

// GET /api/projects/:id/access — Admin/Owner only. Lists every active
// Member in the project's workspace, with whether each currently has
// access to this specific project. Owner/Admin themselves aren't listed —
// they always have full access regardless of this list.
router.get("/:id/access", async (req, res) => {
  const project = await projectsDb.findByIdForCaller(req.params.id, accessFor(req));
  if (!project) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can manage project access." });
  }

  const memberships = (await membershipsDb.listByWorkspace(project.workspaceId)).filter(
    (m) => m.role === "member" && m.status === "active"
  );
  const users = await Promise.all(memberships.map((m) => usersDb.findById(m.userId)));

  const members = memberships.map((m, i) => ({
    userId: m.userId,
    email: users[i]?.email,
    name: users[i]?.name,
    hasAccess: (project.memberAccess || []).includes(m.userId),
  }));

  res.json({ members });
});

// PATCH /api/projects/:id/access  { userId, grant } — Admin/Owner only
router.patch("/:id/access", async (req, res) => {
  const project = await projectsDb.findByIdForCaller(req.params.id, accessFor(req));
  if (!project) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, project.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can manage project access." });
  }

  const { userId, grant } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });

  const membership = await membershipsDb.findActive(project.workspaceId, userId);
  if (!membership || membership.role !== "member") {
    return res.status(400).json({ error: "That person isn't a Member of this workspace." });
  }

  const updated = grant
    ? await projectsDb.grantAccess(project.id, userId)
    : await projectsDb.revokeAccess(project.id, userId);

  res.json({ project: updated });
});

module.exports = router;
