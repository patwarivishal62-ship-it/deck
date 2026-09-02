const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const remindersDb = require("../db/reminders");
const notificationsDb = require("../db/notifications");
const pushSubscriptionsDb = require("../db/pushSubscriptions");
const pushLib = require("../lib/push");

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
router.post("/process-due", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const due = await remindersDb.listDue(now);

    const notifications = [];
    for (const reminder of due) {
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

// GET /api/reminders/push/vapid-key — returns public VAPID key for client subscription
router.get("/push/vapid-key", async (req, res) => {
  const key = pushLib.getVapidPublicKey();
  if (!key) {
    return res.status(404).json({ error: "Push not configured on server. Set VAPID_PUBLIC_KEY." });
  }
  res.json({ publicKey: key });
});

// POST /api/reminders/push/subscribe — save push subscription (real mobile push)
router.post("/push/subscribe", async (req, res) => {
  const { endpoint, keys, userAgent, subscription } = req.body || {};
  // Support both { endpoint, keys } and { subscription: { endpoint, keys } } formats
  let finalEndpoint = endpoint;
  let finalKeys = keys;

  if (subscription) {
    finalEndpoint = subscription.endpoint;
    finalKeys = subscription.keys;
  }

  if (!finalEndpoint) return res.status(400).json({ error: "Endpoint required." });
  if (!finalKeys) return res.status(400).json({ error: "Keys required." });

  try {
    const sub = await pushSubscriptionsDb.upsert({
      userId: req.userId,
      endpoint: finalEndpoint,
      keys: finalKeys,
      userAgent: userAgent || req.headers["user-agent"],
    });

    // Send a welcome push to confirm it works (real push)
    if (pushLib.canSendPush()) {
      try {
        await pushLib.sendToSubscription(sub, {
          title: "Deck push enabled! 🔔",
          body: "You'll get timely nudges to stay organized and aligned, even when Deck is closed.",
          message: "Deck push enabled! You'll get timely nudges.",
          type: "general_nudge",
          link: "/dashboard",
          tag: "welcome-push",
        });
      } catch {}
    }

    res.json({ subscription: sub, pushEnabled: pushLib.canSendPush() });
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
    res.json({ subscriptions: subs, vapidConfigured: !!pushLib.getVapidPublicKey() });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch subscriptions." });
  }
});

// POST /api/reminders/push/test — send a test push to current user (real mobile push)
router.post("/push/test", async (req, res) => {
  try {
    const { message } = req.body || {};
    const payload = {
      title: "Test push from Deck 🔔",
      body: message || "This is a real push notification! Your mobile will receive it even when Deck is closed.",
      message: message || "Test push — if you see this on your phone, real push is working!",
      type: "general_nudge",
      link: "/dashboard",
      tag: "test-push",
    };
    const sent = await pushLib.sendPushToUser(req.userId, payload);
    res.json({ ok: true, sent, pushConfigured: pushLib.canSendPush() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not send test push." });
  }
});

module.exports = router;
