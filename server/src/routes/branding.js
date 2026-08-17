const express = require("express");
const multer = require("multer");
const { put } = require("@vercel/blob");
const { nanoid } = require("nanoid");
const brandingDb = require("../db/branding");
const usersDb = require("../db/users");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// Public: get current branding (logo/favicon) — no auth so login page can show it
router.get("/", async (req, res) => {
  try {
    const branding = await brandingDb.get();
    res.json({ branding: branding || { logoUrl: null, faviconUrl: null } });
  } catch (err) {
    res.status(500).json({ error: "Could not load branding" });
  }
});

// Protected: upload logo or favicon — any logged-in user for now (small team)
// Expects multipart/form-data with field "file" and query ?type=logo or ?type=favicon
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    // Branding is owner-managed via UI (only patwarivishal62@gmail.com sees the Branding link), but API stays open for owner to work
    // If you need to lock it fully, re-enable the email check below
    // try { const me = await usersDb.findById(req.userId); if ((me?.email||"").trim().toLowerCase() !== "patwarivishal62@gmail.com") return res.status(403).json({ error: "Only owner can update branding" }); } catch {}
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "File too large (max 5MB)" : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    const type = req.query.type || req.body.type;
    if (!["logo", "favicon"].includes(type)) {
      return res.status(400).json({ error: "type must be logo or favicon" });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "Only image files allowed" });

    try {
      let url;
      let blobPathname = null;

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const pathname = `branding/${type}-${nanoid()}-${req.file.originalname}`;
        const blob = await put(pathname, req.file.buffer, {
          access: "public",
          contentType: req.file.mimetype,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        url = blob.url;
        blobPathname = pathname;
      } else {
        // Fallback: store as data URL (works for small favicons/logos <5MB, no external storage needed)
        const b64 = req.file.buffer.toString("base64");
        url = `data:${req.file.mimetype};base64,${b64}`;
      }

      const branding = await brandingDb.upsert({
        updatedBy: req.userId,
        ...(type === "logo" ? { logoUrl: url, logoBlobPathname: blobPathname } : {}),
        ...(type === "favicon" ? { faviconUrl: url, faviconBlobPathname: blobPathname } : {}),
      });

      res.json({ branding });
    } catch (e) {
      console.error("Branding upload failed", e);
      res.status(500).json({ error: "Could not save branding" });
    }
  });
});

// Protected: reset to default (remove custom)
router.delete("/", requireAuth, async (req, res) => {
  // See note above — UI hides Branding for non-owners, API stays open for owner
  try {
    const type = req.query.type;
    if (type && !["logo", "favicon"].includes(type)) return res.status(400).json({ error: "type must be logo or favicon" });

    let update = {};
    if (!type || type === "logo") update.logoUrl = null;
    if (!type || type === "favicon") update.faviconUrl = null;

    const branding = await brandingDb.upsert({ ...update, updatedBy: req.userId });
    res.json({ branding });
  } catch (e) {
    res.status(500).json({ error: "Could not reset branding" });
  }
});

module.exports = router;
