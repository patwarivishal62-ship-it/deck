const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const remindersDb = require("../db/reminders");
const notificationsDb = require("../db/notifications");
const pushSubscriptionsDb = require("../db/pushSubscriptions");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

// GET /api/reminders — list user's reminders
router.get("/", async (req, res) => {
  try {
    const includeSent = req.query.includeSent === "true";
    const reminders = includeSent
      ? await remindersDb.listAllForUser(req.userId)
      : await remindersDb.listForUser(req.userId, false);
    res.json({ reminders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch reminders." });
  }
});

// POST /api/reminders — create a reminder
router.post("/", async (req, res) => {
  const { message, scheduledAt, frequency, type, link, projectId, taskId, workspaceId } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  const allowedFreq = ["once", "daily", "weekly", "weekdays", "hourly"];
  const allowedTypes = ["task_progress", "task_due", "goal_checkin", "general_nudge", "custom"];

  try {
    const reminder = await remindersDb.create({
      userId: req.userId,
      workspaceId: workspaceId || req.workspaces.find((w) => w.personal)?.id || req.workspaceIds[0],
      projectId: projectId || null,
      taskId: taskId || null,
      type: allowedTypes.includes(type) ? type : "custom",
      message: message.trim().slice(0, 300),
      link: link || "/dashboard",
      scheduledAt: scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      frequency: allowedFreq.includes(frequency) ? frequency : "once",
    });
    res.status(201).json({ reminder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create reminder." });
  }
});

// PATCH /api/reminders/:id
router.patch("/:id", async (req, res) => {
  const { message, scheduledAt, frequency, sent } = req.body || {};
  try {
    const existing = await remindersDb.findById(req.params.id);
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Reminder not found." });
    }
    const updated = await remindersDb.update(req.params.id, {
      ...(message ? { message: message.trim().slice(0, 300) } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(frequency ? { frequency } : {}),
      ...(sent !== undefined ? { sent } : {}),
    });
    res.json({ reminder: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update reminder." });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", async (req, res) => {
  try {
    await remindersDb.remove(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not delete reminder." });
  }
});

// POST /api/reminders/seed — seed default activation nudges
router.post("/seed", async (req, res) => {
  try {
    await remindersDb.seedDefaultNudges(req.userId);
    const reminders = await remindersDb.listForUser(req.userId);
    res.json({ reminders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not seed reminders." });
  }
});

// POST /api/reminders/process-due — internal endpoint to process due reminders into notifications
// This is called automatically on notifications fetch, but also can be triggered manually
router.post("/process-due", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const due = await remindersDb.listDue(now);

    const notifications = [];
    for (const reminder of due) {
      // Only process reminders for this user unless called internally
      if (req.body?.all !== true && reminder.userId !== req.userId) continue;

      await notificationsDb.create({
        userId: reminder.userId,
        workspaceId: reminder.workspaceId,
        projectId: reminder.projectId,
        type: reminder.type,
        message: reminder.message,
        link: reminder.link,
      });
      await remindersDb.markSent(reminder.id);
      notifications.push(reminder);
    }

    res.json({ processed: notifications.length, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not process reminders." });
  }
});

// Push subscription management

// POST /api/reminders/push/subscribe
router.post("/push/subscribe", async (req, res) => {
  const { endpoint, keys, userAgent } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "Endpoint required." });
  try {
    const sub = await pushSubscriptionsDb.upsert({
      userId: req.userId,
      endpoint,
      keys,
      userAgent: userAgent || req.headers["user-agent"],
    });
    res.json({ subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save subscription." });
  }
});

router.post("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: "Endpoint required." });
  try {
    await pushSubscriptionsDb.removeByEndpoint(req.userId, endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not unsubscribe." });
  }
});

router.get("/push", async (req, res) => {
  try {
    const subs = await pushSubscriptionsDb.listForUser(req.userId);
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch subscriptions." });
  }
});

module.exports = router;
