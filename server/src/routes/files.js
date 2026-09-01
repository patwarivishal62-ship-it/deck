const express = require("express");
const multer = require("multer");
const { put } = require("@vercel/blob");
const { nanoid } = require("nanoid");
const projectsDb = require("../db/projects");
const filesDb = require("../db/files");
const activityLogDb = require("../db/activityLog");
const usersDb = require("../db/users");
const membershipsDb = require("../db/memberships");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

// Kept well under Vercel Blob's free-tier monthly totals (1 GB storage,
// 10 GB transfer) so a handful of uploads across a few projects doesn't
// eat the whole budget in one go. Easy to raise later if it's too tight.
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

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

// GET /api/projects/:projectId/files
router.get("/:projectId/files", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const files = await filesDb.listByProject(project.id);
  res.json({ files });
});

// POST /api/projects/:projectId/files — multipart/form-data, field name "file"
router.post("/:projectId/files", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `File is too large (max ${MAX_FILE_SIZE / (1024 * 1024)} MB).`
          : "Upload failed.";
      return res.status(400).json({ error: message });
    }

    const project = await ownedProject(req.params.projectId, req);
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (!req.file) return res.status(400).json({ error: "No file was uploaded." });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: "File storage isn't configured yet." });
    }

    try {
      const blobPathname = `projects/${project.id}/${nanoid()}-${req.file.originalname}`;
      const blob = await put(blobPathname, req.file.buffer, {
        access: "public",
        contentType: req.file.mimetype,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      const file = await filesDb.create({
        workspaceId: project.workspaceId,
        projectId: project.id,
        uploadedBy: req.userId,
        filename: req.file.originalname,
        url: blob.url,
        blobPathname,
        contentType: req.file.mimetype,
        size: req.file.size,
      });

      const actor = await usersDb.findById(req.userId);
      await activityLogDb.log({
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorUserId: req.userId,
        type: "file_uploaded",
        message: `${actor?.name || actor?.email} uploaded "${file.filename}"`,
      });

      res.status(201).json({ file });
    } catch (uploadErr) {
      console.error("File upload failed:", uploadErr);
      res.status(500).json({ error: "Could not upload file." });
    }
  });
});

// DELETE /api/projects/:projectId/files/:fileId — uploader, or workspace
// Admin/Owner as moderation, matching the comments-deletion pattern
router.delete("/:projectId/files/:fileId", async (req, res) => {
  const project = await ownedProject(req.params.projectId, req);
  if (!project) return res.status(404).json({ error: "Project not found." });

  const file = await filesDb.findById(req.params.fileId);
  if (!file || file.projectId !== project.id) {
    return res.status(404).json({ error: "File not found." });
  }

  const role = roleFor(req, project.workspaceId);
  const isUploader = file.uploadedBy === req.userId;
  if (!isUploader && !membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "You can only delete files you uploaded." });
  }

  await filesDb.remove(file.id);
  res.json({ ok: true });
});

module.exports = router;
