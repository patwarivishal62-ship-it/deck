const express = require("express");
const entriesDb = require("../db/personalEntries");
const { requireAuth } = require("../middleware/auth");

// Personal notes & to-dos — private to the signed-in user. Deliberately uses
// only requireAuth (no attachWorkspaces): these are not shared artifacts, so
// there's nothing to scope beyond the caller's own id.
const router = express.Router();
router.use(requireAuth);

const KINDS = ["note", "todo"];

function validISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/", async (req, res) => {
  const entries = await entriesDb.listForUser(req.userId);
  res.json({ entries });
});

router.post("/", async (req, res) => {
  const { kind = "todo", text, date, dueDate } = req.body || {};

  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: "Kind must be 'note' or 'todo'." });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required." });
  }
  if (date && !validISODate(date)) {
    return res.status(400).json({ error: "Invalid date." });
  }
  if (dueDate && !validISODate(dueDate)) {
    return res.status(400).json({ error: "Invalid due date." });
  }

  const entry = await entriesDb.create({
    userId: req.userId,
    kind,
    text: text.trim(),
    date: date || todayISODate(),
    dueDate: dueDate || null,
  });
  res.status(201).json({ entry });
});

router.patch("/:id", async (req, res) => {
  const entry = await entriesDb.findById(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: "Entry not found." });

  const { kind, text, date, dueDate, done } = req.body || {};
  const fields = {};

  if (kind !== undefined) {
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ error: "Kind must be 'note' or 'todo'." });
    }
    fields.kind = kind;
  }
  if (text !== undefined) {
    if (!text.trim()) return res.status(400).json({ error: "Text is required." });
    fields.text = text.trim();
  }
  if (date !== undefined) {
    if (!validISODate(date)) return res.status(400).json({ error: "Invalid date." });
    fields.date = date;
  }
  if (dueDate !== undefined) {
    if (dueDate && !validISODate(dueDate)) {
      return res.status(400).json({ error: "Invalid due date." });
    }
    fields.dueDate = dueDate || null;
  }
  if (done !== undefined) fields.done = Boolean(done);

  const updated = await entriesDb.update(entry.id, req.userId, fields);
  res.json({ entry: updated });
});

router.delete("/:id", async (req, res) => {
  const entry = await entriesDb.findById(req.params.id, req.userId);
  if (!entry) return res.status(404).json({ error: "Entry not found." });

  await entriesDb.remove(entry.id, req.userId);
  res.json({ ok: true });
});

module.exports = router;
