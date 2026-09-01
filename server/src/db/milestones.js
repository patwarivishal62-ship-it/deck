const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("milestones");
}

function toMilestone(doc) {
  if (!doc) return null;
  const { _id, ...milestone } = doc;
  return milestone;
}

async function listByProject(projectId) {
  const docs = await collection().find({ projectId }).sort({ date: 1 }).toArray();
  return docs.map(toMilestone);
}

async function findByIdInProject(id, projectId) {
  return toMilestone(await collection().findOne({ id, projectId }));
}

async function create({ projectId, createdBy, title, date, notes }) {
  const milestone = {
    id: nanoid(),
    projectId,
    createdBy,
    title,
    date,
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(milestone);
  return toMilestone(milestone);
}

async function update(id, fields) {
  const allowed = ["title", "date", "notes"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return toMilestone(await collection().findOne({ id }));

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return toMilestone(await collection().findOne({ id }));
}

async function remove(id) {
  await collection().deleteOne({ id });
}

async function removeByProject(projectId) {
  await collection().deleteMany({ projectId });
}

module.exports = { listByProject, findByIdInProject, create, update, remove, removeByProject };
