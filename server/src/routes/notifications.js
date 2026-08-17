const express = require("express");
const projectsDb = require("../db/projects");
const notificationsDb = require("../db/notifications");
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
async function computeDeadlineReminders(req, projects) {
  const list =
    projects ||
    (await projectsDb.listForCaller(
      {
        fullAccessWorkspaceIds: req.fullAccessWorkspaceIds,
        restrictedWorkspaceIds: req.restrictedWorkspaceIds,
        userId: req.userId,
      },
      { archived: false }
    ));

  const today = todayISODate();
  const horizon = addDaysISO(today, 2);
  const now = new Date().toISOString();

  const reminders = [];
  for (const project of list) {
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
  return { reminders, projects: list };
}

// PA daily nudges — morning / midday / evening, synthetic and time-aware
// Keeps it simple: one notification per period per day, only when you look
function computePANudges(projects) {
  const today = todayISODate();
  const now = new Date();
  const hour = now.getHours();
  const createdAt = now.toISOString();
  let pending = 0;
  let dueToday = 0;
  let overdue = 0;
  for (const p of projects) {
    for (const t of p.tasks || []) {
      if (t.status === "done") continue;
      pending++;
      if (t.dueDate === today) dueToday++;
      else if (t.dueDate && t.dueDate < today) overdue++;
    }
  }

  const nudges = [];
  if (hour >= 6 && hour < 12) {
    // Morning: ask what are we doing today
    let msg;
    if (pending === 0) msg = `Good morning! What are we doing today? Tell Deck PA your plan.`;
    else if (dueToday || overdue) msg = `Good morning! ${dueToday} due today${overdue ? `, ${overdue} overdue` : ""} — what are we tackling first?`;
    else msg = `Good morning! ${pending} pending, none due today — plan your day with Deck PA.`;
    nudges.push({
      id: `pa-morning-${today}`,
      type: "pa_morning",
      message: msg,
      link: "/projects",
      read: false,
      synthetic: true,
      createdAt,
    });
  } else if (hour >= 12 && hour < 17) {
    if (pending > 0) {
      nudges.push({
        id: `pa-midday-${today}`,
        type: "pa_midday",
        message: `Midday check — ${pending} pending, ${dueToday} due today. Want to add or update anything? Ask Deck PA.`,
        link: "/projects",
        read: false,
        synthetic: true,
        createdAt,
      });
    }
  } else if (hour >= 17 && hour < 23) {
    if (pending > 0) {
      nudges.push({
        id: `pa-evening-${today}`,
        type: "pa_evening",
        message: `Evening wrap — ${dueToday} were due today, ${overdue} overdue. Update progress and I’ll push pending to tomorrow.`,
        link: "/projects",
        read: false,
        synthetic: true,
        createdAt,
      });
    }
  }
  return nudges;
}

router.get("/", async (req, res) => {
  const [stored, deadlineData] = await Promise.all([
    notificationsDb.listForUser(req.userId),
    computeDeadlineReminders(req),
  ]);
  const { reminders, projects } = deadlineData;
  const paNudges = computePANudges(projects);

  const synthetic = [...reminders, ...paNudges];
  const notifications = [...synthetic, ...stored].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const unreadCount = synthetic.length + stored.filter((n) => !n.read).length;

  res.json({ notifications, unreadCount });
});

router.patch("/:id/read", async (req, res) => {
  // Synthetic reminders have no stored record to mark — they just keep reappearing
  if (req.params.id.startsWith("deadline-") || req.params.id.startsWith("pa-")) return res.json({ ok: true });

  await notificationsDb.markRead(req.params.id, req.userId);
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await notificationsDb.markAllRead(req.userId);
  res.json({ ok: true });
});

module.exports = router;
