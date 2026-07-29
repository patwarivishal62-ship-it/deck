const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("notifications");
}

function toNotification(doc) {
  if (!doc) return null;
  const { _id, ...notification } = doc;
  return notification;
}

// type: project_created | task_assigned | comment | mention | workspace_invite
async function create({ userId, workspaceId, projectId, type, message, link }) {
  const notification = {
    id: nanoid(),
    userId,
    workspaceId,
    projectId: projectId || null,
    type,
    message,
    link: link || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(notification);
  return toNotification(notification);
}

// Notifications are per-recipient records, so fan-out to several people is
// just several create() calls with the same message — simple and correct,
// at the (fine, at this scale) cost of some duplication across documents.
async function createMany(recipients) {
  await Promise.all(recipients.map((r) => create(r)));
}

async function listForUser(userId, limit = 50) {
  const docs = await collection().find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(toNotification);
}

async function countUnread(userId) {
  return collection().countDocuments({ userId, read: false });
}

async function markRead(id, userId) {
  await collection().updateOne({ id, userId }, { $set: { read: true } });
}

async function markAllRead(userId) {
  await collection().updateMany({ userId, read: false }, { $set: { read: true } });
}

module.exports = { create, createMany, listForUser, countUnread, markRead, markAllRead };
