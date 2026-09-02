const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("reminders");
}

function toReminder(doc) {
  if (!doc) return null;
  const { _id, ...r } = doc;
  return r;
}

// type: task_progress | task_due | goal_checkin | general_nudge | custom
// frequency: once | daily | weekly | weekdays | custom (for recurring)
// status: pending | sent | cancelled
async function create({ userId, workspaceId, projectId, taskId, type, message, link, scheduledAt, frequency, meta }) {
  const reminder = {
    id: nanoid(),
    userId,
    workspaceId: workspaceId || null,
    projectId: projectId || null,
    taskId: taskId || null,
    type: type || "custom",
    message,
    link: link || null,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
    frequency: frequency || "once", // once, daily, weekly, weekdays, hourly
    sent: false,
    sentAt: null,
    count: 0, // how many times sent
    meta: meta || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await collection().insertOne(reminder);
  return toReminder(reminder);
}

async function listForUser(userId, includeSent = false) {
  const filter = { userId };
  if (!includeSent) filter.sent = false;
  const docs = await collection().find(filter).sort({ scheduledAt: 1 }).toArray();
  return docs.map(toReminder);
}

async function listDue(nowISO = new Date().toISOString()) {
  const docs = await collection()
    .find({ scheduledAt: { $lte: nowISO }, sent: false })
    .sort({ scheduledAt: 1 })
    .limit(100)
    .toArray();
  return docs.map(toReminder);
}

async function listAllForUser(userId) {
  const docs = await collection().find({ userId }).sort({ scheduledAt: -1 }).limit(100).toArray();
  return docs.map(toReminder);
}

async function findById(id) {
  return toReminder(await collection().findOne({ id }));
}

async function markSent(id) {
  const reminder = await findById(id);
  if (!reminder) return null;

  let nextScheduledAt = null;
  const now = new Date();
  // compute next occurrence for recurring
  if (reminder.frequency === "daily") {
    const next = new Date(reminder.scheduledAt);
    next.setDate(next.getDate() + 1);
    if (next <= now) {
      next.setDate(now.getDate() + 1);
      next.setHours(new Date(reminder.scheduledAt).getHours(), new Date(reminder.scheduledAt).getMinutes(), 0, 0);
    }
    nextScheduledAt = next.toISOString();
  } else if (reminder.frequency === "weekdays") {
    const next = new Date(reminder.scheduledAt);
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6);
    nextScheduledAt = next.toISOString();
  } else if (reminder.frequency === "weekly") {
    const next = new Date(reminder.scheduledAt);
    next.setDate(next.getDate() + 7);
    nextScheduledAt = next.toISOString();
  } else if (reminder.frequency === "hourly") {
    const next = new Date(now.getTime() + 60 * 60 * 1000);
    nextScheduledAt = next.toISOString();
  }

  if (nextScheduledAt) {
    // recurring: reset sent false and update scheduledAt
    await collection().updateOne(
      { id },
      {
        $set: {
          scheduledAt: nextScheduledAt,
          sent: false,
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        $inc: { count: 1 },
      }
    );
  } else {
    await collection().updateOne(
      { id },
      {
        $set: { sent: true, sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        $inc: { count: 1 },
      }
    );
  }
  return findById(id);
}

async function update(id, fields) {
  const allowed = ["message", "scheduledAt", "frequency", "type", "link", "sent"];
  const setDoc = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) setDoc[k] = fields[k];
  }
  if (Object.keys(setDoc).length === 0) return findById(id);
  setDoc.updatedAt = new Date().toISOString();
  await collection().updateOne({ id }, { $set: setDoc });
  return findById(id);
}

async function remove(id, userId) {
  await collection().deleteOne({ id, userId });
}

async function removeByUser(userId) {
  await collection().deleteMany({ userId });
}

// Seed default nudges for a new user to drive activation
async function seedDefaultNudges(userId) {
  const existing = await collection().countDocuments({ userId, type: "general_nudge" });
  if (existing > 0) return;

  const now = new Date();
  const defaults = [
    {
      message: "👋 Welcome to Deck! Tap to organize your first project and stay aligned.",
      link: "/projects",
      scheduledAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(), // 5 min
    },
    {
      message: "💡 Quick tip: Use voice notes to capture tasks 3x faster. Try the mic button!",
      link: "/dashboard",
      scheduledAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
    },
    {
      message: "📋 You have tasks waiting. Update your progress to keep your team in sync.",
      link: "/personal",
      scheduledAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
    },
    {
      message: "🚀 Stay organized — review your goals and keep momentum going!",
      link: "/dashboard",
      scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
    },
  ];

  for (const d of defaults) {
    await create({
      userId,
      type: "general_nudge",
      message: d.message,
      link: d.link,
      scheduledAt: d.scheduledAt,
      frequency: "once",
    });
  }
}

module.exports = {
  create,
  listForUser,
  listDue,
  listAllForUser,
  findById,
  markSent,
  update,
  remove,
  removeByUser,
  seedDefaultNudges,
};
