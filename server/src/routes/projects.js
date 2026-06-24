const express = require("express");
const projectsDb = require("../db/projects");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/projects — list all projects for the signed-in user
router.get("/", (req, res) => {
  const projects = projectsDb.listByUser(req.userId);
  res.json({ projects });
});

// POST /api/projects — create a project
router.post("/", (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }
  const project = projectsDb.create({
    userId: req.userId,
    name: name.trim(),
    description: (description || "").trim(),
  });
  res.status(201).json({ project });
});

// GET /api/projects/:id — single project with goals + tasks
router.get("/:id", (req, res) => {
  const project = projectsDb.findByIdForUser(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json({ project });
});

// PATCH /api/projects/:id — update name/description
router.patch("/:id", (req, res) => {
  const existing = projectsDb.findByIdForUser(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Project not found." });

  const { name, description } = req.body || {};
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }

  const project = projectsDb.update(req.params.id, {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(description !== undefined ? { description: description.trim() } : {}),
  });
  res.json({ project });
});

// DELETE /api/projects/:id — delete project + cascading goals/tasks
router.delete("/:id", (req, res) => {
  const existing = projectsDb.findByIdForUser(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: "Project not found." });

  projectsDb.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
