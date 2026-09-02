const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("voiceNotes");
}

function toVoiceNote(doc) {
  if (!doc) return null;
  const { _id, ...note } = doc;
  return note;
}

async function create({ userId, workspaceId, projectId, transcript, summary, actions, rawActions }) {
  const voiceNote = {
    id: nanoid(),
    userId,
    workspaceId: workspaceId || null,
    projectId: projectId || null,
    transcript,
    summary: summary || transcript.slice(0, 200),
    actions: actions || [],
    rawActions: rawActions || [],
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(voiceNote);
  return toVoiceNote(voiceNote);
}

async function listForUser(userId, limit = 50) {
  const docs = await collection().find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs.map(toVoiceNote);
}

async function findById(id) {
  return toVoiceNote(await collection().findOne({ id }));
}

async function remove(id, userId) {
  await collection().deleteOne({ id, userId });
}

async function removeByUser(userId) {
  await collection().deleteMany({ userId });
}

module.exports = {
  create,
  listForUser,
  findById,
  remove,
  removeByUser,
};
