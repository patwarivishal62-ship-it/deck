const express = require("express");
const projectsDb = require("../db/projects");
const membershipsDb = require("../db/memberships");
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

// GET /api/projects — across every workspace the caller belongs to
router.get("/", async (req, res) => {
  const { search, tags, priority, archived, sort } = req.query;

  let archivedOption = false;
  if (archived === "true") archivedOption = true;
  else if (archived === "all") archivedOption = "all";

  const projects = await projectsDb.listByWorkspaces(req.workspaceIds, {
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
// the caller's personal workspace if omitted)
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
  if (!roleFor(req, workspaceId)) {
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
  });
  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  const project = await projectsDb.findByIdInWorkspaces(req.params.id, req.workspaceIds);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ project, role: roleFor(req, project.workspaceId) });
});

// PATCH /api/projects/:id — any active member can edit
router.patch("/:id", async (req, res) => {
  const existing = await projectsDb.findByIdInWorkspaces(req.params.id, req.workspaceIds);
  if (!existing) return res.status(404).json({ error: "Project not found." });

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
  const existing = await projectsDb.findByIdInWorkspaces(req.params.id, req.workspaceIds);
  if (!existing) return res.status(404).json({ error: "Project not found." });

  const role = roleFor(req, existing.workspaceId);
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only workspace admins or owners can delete projects." });
  }

  await projectsDb.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
