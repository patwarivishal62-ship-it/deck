const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("activityLog");
}

function toEntry(doc) {
  if (!doc) return null;
  const { _id, ...entry } = doc;
  return entry;
}

// type is one of: project_created, goal_created, goal_deleted, task_created,
// task_completed, task_deleted, comment_added — kept to meaningful,
// non-noisy events rather than logging every field edit.
async function log({ workspaceId, projectId, actorUserId, type, message }) {
  const entry = {
    id: nanoid(),
    workspaceId,
    projectId,
    actorUserId,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(entry);
  return toEntry(entry);
}

async function listByProject(projectId, limit = 50) {
  const docs = await collection()
    .find({ projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toEntry);
}

async function removeByProject(projectId) {
  await collection().deleteMany({ projectId });
}

module.exports = { log, listByProject, removeByProject };
