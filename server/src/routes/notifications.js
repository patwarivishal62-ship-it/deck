const express = require("express");
const projectsDb = require("../db/projects");
const entriesDb = require("../db/personalEntries");
const notificationsDb = require("../db/notifications");
const remindersDb = require("../db/reminders");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");

const router = express.Router();
router.use(requireAuth);
router.use(attachWorkspaces);

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "Deadline approaching" isn't a stored notification — there's no background
// job on Render's free tier to generate it ahead of time, so instead it's
// computed fresh every time someone checks their notifications: any
// not-done task, due today through 2 days out, across every project they
// can currently see. This means it's always accurate and needs no cron
// job at all, at the cost of only appearing when someone actually looks
// (fine for an in-app center, not a push notification).
async function computeDeadlineReminders(req) {
  const projects = await projectsDb.listForCaller(
    {
      fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
      restrictedWorkspaceIds: req.restrictedWorkspaceIds,
      userId: req.userId,
    },
    { archived: false }
  );

  const today = todayISODate();
  const horizon = addDaysISO(today, 2);
  const now = new Date().toISOString();

  const reminders = [];
  for (const project of projects) {
    for (const task of project.tasks) {
      if (task.status === "done") continue;
      if (!task.dueDate || task.dueDate < today || task.dueDate > horizon) continue;

      reminders.push({
        id: `deadline-${task.id}`,
        type: "deadline_approaching",
        message:
          task.dueDate === today
            ? `"${task.title}" in ${project.name} is due today`
            : `"${task.title}" in ${project.name} is due ${task.dueDate}`,
        link: `/projects/${project.id}`,
        read: false,
        synthetic: true,
        createdAt: now,
      });
    }
  }
  return reminders;
}

// Personal to-dos work the same way: no cron needed — every check of the
// notification center recomputes which of the user's to-dos are still open and
// due today (or overdue), so the user gets nudged on what they completed or not.
async function computePersonalTodoReminders(req) {
  const entries = await entriesDb.listForUser(req.userId);
  const today = todayISODate();

  const reminders = [];
  for (const entry of entries) {
    if (entry.kind !== "todo" || entry.done) continue;
    if (!entry.dueDate || entry.dueDate > today) continue;

    const overdue = entry.dueDate < today;
    reminders.push({
      id: `todo-${entry.id}`,
      type: "personal_todo_due",
      message: overdue
        ? `Personal to-do "${entry.text}" is overdue — due ${entry.dueDate}`
        : `Personal to-do "${entry.text}" is due today`,
      link: "/personal",
      read: false,
      synthetic: true,
      createdAt: new Date().toISOString(),
    });
  }
  return reminders;
}

// Process due scheduled reminders into real notifications
async function processDueRemindersForUser(userId) {
  try {
    const due = await remindersDb.listDue(new Date().toISOString());
    const userDue = due.filter((r) => r.userId === userId);
    for (const reminder of userDue) {
      await notificationsDb.create({
        userId: reminder.userId,
        workspaceId: reminder.workspaceId,
        projectId: reminder.projectId,
        type: reminder.type,
        message: reminder.message,
        link: reminder.link,
      });
      await remindersDb.markSent(reminder.id);
    }
    return userDue.length;
  } catch (err) {
    console.error("Failed to process due reminders:", err);
    return 0;
  }
}

router.get("/", async (req, res) => {
  // Process any due scheduled reminders first
  await processDueRemindersForUser(req.userId);

  const [stored, deadlineReminders, todoReminders] = await Promise.all([
    notificationsDb.listForUser(req.userId),
    computeDeadlineReminders(req),
    computePersonalTodoReminders(req),
  ]);

  const reminders = [...deadlineReminders, ...todoReminders];
  const notifications = [...reminders, ...stored].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const unreadCount = reminders.length + stored.filter((n) => !n.read).length;

  res.json({ notifications, unreadCount });
});

router.patch("/:id/read", async (req, res) => {
  // Synthetic reminders (deadline-… and todo-…) have no stored record to mark —
  // they just keep reappearing until the task/to-do is done or its date passes,
  // which is the point of a reminder.
  if (req.params.id.startsWith("deadline-") || req.params.id.startsWith("todo-")) {
    return res.json({ ok: true });
  }

  await notificationsDb.markRead(req.params.id, req.userId);
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await notificationsDb.markAllRead(req.userId);
  res.json({ ok: true });
});

// GET /api/notifications/stats — for debugging / analytics
router.get("/stats", async (req, res) => {
  try {
    const [stored, deadlineReminders, todoReminders] = await Promise.all([
      notificationsDb.listForUser(req.userId),
      computeDeadlineReminders(req),
      computePersonalTodoReminders(req),
    ]);
    const dueReminders = await remindersDb.listForUser(req.userId, false);
    res.json({
      storedCount: stored.length,
      unreadStored: stored.filter((n) => !n.read).length,
      synthetic: deadlineReminders.length + todoReminders.length,
      scheduledPending: dueReminders.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch stats" });
  }
});

module.exports = router;
