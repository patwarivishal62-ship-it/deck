const express = require("express");
const projectsDb = require("../db/projects");
const tasksDb = require("../db/tasks");
const commentsDb = require("../db/comments");
const activityLogDb = require("../db/activityLog");
const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");
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

// Everyone who can actually see this specific project: every workspace
// Owner/Admin (they see all projects), plus Members who've been explicitly
// granted access to this one. This is the set @mentions are allowed to
// tag — mentioning someone who can't see the project would be broken.
async function collaboratorsFor(project) {
  const memberships = (await membershipsDb.listByWorkspace(project.workspaceId)).filter(
    (m) => m.status === "active"
  );
  const eligible = memberships.filter(
    (m) => m.role === "owner" || m.role === "admin" || (project.memberAccess || []).includes(m.userId)
  );
  const users = await Promise.all(eligible.map((m) => usersDb.findById(m.userId)));
  return eligible.map((m, i) => ({ userId: m.userId, name: users[i]?.name, email: users[i]?.email }));
}

async function withAuthors(comments) {
  const uniqueIds = Array.from(new Set(comments.map((c) => c.authorId)));
  const users = await Promise.all(uniqueIds.map((id) => usersDb.findById(id)));
  const userById = {};
  users.forEach((u) => u && (userById[u.id] = u));
  return comments.map((c) => ({
    ...c,
    authorName: userById[c.authorId]?.name,
    authorEmail: userById[c.authorId]?.email,
  }));
}

// GET /api/projects/:projectId/collaborators — for the @mention dropdown
router.get("/:projectId/collaborators", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const collaborators = await collaboratorsFor(project);
  res.json({ collaborators });
});

// GET /api/projects/:projectId/comments?taskId=... — project-level thread if
// no taskId, that task's thread if one is given
router.get("/:projectId/comments", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { taskId } = req.query;
  if (taskId) {
    const task = await tasksDb.findByIdInProject(taskId, project.id);
    if (!task) return res.status(404).json({ error: "Task not found." });
  }

  const comments = await commentsDb.listForProject(project.id, taskId || null);
  res.json({ comments: await withAuthors(comments) });
});

// POST /api/projects/:projectId/comments  { body, taskId? }
router.post("/:projectId/comments", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const { body, taskId } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "Comment can't be empty." });
  }
  if (taskId) {
    const task = await tasksDb.findByIdInProject(taskId, project.id);
    if (!task) return res.status(404).json({ error: "Task not found." });
  }

  const collaborators = await collaboratorsFor(project);
  const comment = await commentsDb.create({
    workspaceId: project.workspaceId,
    projectId: project.id,
    taskId: taskId || null,
    authorId: req.userId,
    body: body.trim(),
    validUserIds: collaborators.map((c) => c.userId),
  });

  const author = await usersDb.findById(req.userId);
  await activityLogDb.log({
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorUserId: req.userId,
    type: "comment_added",
    message: taskId
      ? `${author?.name || author?.email} commented on a task`
      : `${author?.name || author?.email} commented on the project`,
  });

  res.status(201).json({ comment: (await withAuthors([comment]))[0] });
});

// DELETE /api/projects/:projectId/comments/:commentId — author, or
// workspace Admin/Owner as moderation
router.delete("/:projectId/comments/:commentId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const comment = await commentsDb.findById(req.params.commentId);
  if (!comment || comment.projectId !== project.id) {
    return res.status(404).json({ error: "Comment not found." });
  }

  const role = roleFor(req, project.workspaceId);
  const isAuthor = comment.authorId === req.userId;
  if (!isAuthor && !membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "You can only delete your own comments." });
  }

  await commentsDb.remove(comment.id);
  res.json({ ok: true });
});

// GET /api/projects/:projectId/activity — recent timeline for this project
router.get("/:projectId/activity", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const entries = await activityLogDb.listByProject(project.id);
  const uniqueIds = Array.from(new Set(entries.map((e) => e.actorUserId)));
  const users = await Promise.all(uniqueIds.map((id) => usersDb.findById(id)));
  const userById = {};
  users.forEach((u) => u && (userById[u.id] = u));

  res.json({
    activity: entries.map((e) => ({ ...e, actorName: userById[e.actorUserId]?.name })),
  });
});

module.exports = router;
