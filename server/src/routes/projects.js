const express = require("express");
const projectsDb = require("../db/projects");
const { requireAuth } = require("../middleware/auth");
const { PRIORITY_KEYS, PROJECT_SORTS } = require("../constants");

const router = express.Router();
router.use(requireAuth);

function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean);
  return String(input)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// GET /api/projects — list, with optional ?search=&tags=a,b&priority=high&archived=true|false|all&sort=
router.get("/", async (req, res) => {
  const { search, tags, priority, archived, sort } = req.query;

  let archivedOption = false;
  if (archived === "true") archivedOption = true;
  else if (archived === "all") archivedOption = "all";

  const projects = await projectsDb.listByUser(req.userId, {
    search: search ? String(search).trim() : undefined,
    tags: parseTags(tags),
    priority: PRIORITY_KEYS.includes(priority) ? priority : undefined,
    archived: archivedOption,
    sort: PROJECT_SORTS.includes(sort) ? sort : "newest",
  });

  res.json({ projects });
});

// POST /api/projects — create a project
router.post("/", async (req, res) => {
  const { name, description, tags, priority, dueDate } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }
  if (priority !== undefined && priority !== "" && !PRIORITY_KEYS.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }

  const project = await projectsDb.create({
    userId: req.userId,
    name: name.trim(),
    description: (description || "").trim(),
    tags: parseTags(tags),
    priority: priority || "medium",
    dueDate: dueDate || null,
  });
  res.status(201).json({ project });
});

// GET /api/projects/:id — single project with goals + tasks
router.get("/:id", async (req, res) => {
  const project = await projectsDb.findByIdForUser(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ project });
});

// PATCH /api/projects/:id — update name/description/tags/priority/dueDate/archived
router.patch("/:id", async (req, res) => {
  const existing = await projectsDb.findByIdForUser(req.params.id, req.userId);
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

// DELETE /api/projects/:id — delete project + cascading goals/tasks
router.delete("/:id", async (req, res) => {
  const existing = await projectsDb.findByIdForUser(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Project not found." });

  await projectsDb.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
