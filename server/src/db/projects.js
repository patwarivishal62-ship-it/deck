const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");
const goalsDb = require("./goals");
const tasksDb = require("./tasks");

function collection() {
  return getDb().collection("projects");
}

function toProject(doc) {
  if (!doc) return null;
  const { _id, ...project } = doc;
  return project;
}

async function attachChildren(project) {
  if (!project) return null;
  const [goals, tasks] = await Promise.all([
    goalsDb.listByProject(project.id),
    tasksDb.listByProject(project.id),
  ]);
  return { ...project, goals, tasks };
}

async function listByUser(userId) {
  const docs = await collection().find({ userId }).sort({ createdAt: 1, _id: 1 }).toArray();
  return Promise.all(docs.map(toProject).map(attachChildren));
}

async function findById(id) {
  return toProject(await collection().findOne({ id }));
}

async function findByIdForUser(id, userId) {
  const project = toProject(await collection().findOne({ id, userId }));
  return project ? attachChildren(project) : null;
}

async function create({ userId, name, description }) {
  const project = {
    id: nanoid(),
    userId,
    name,
    description,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(project);
  return attachChildren(toProject(project));
}

async function update(id, fields) {
  const allowed = ["name", "description"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return attachChildren(await findById(id));

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return attachChildren(await findById(id));
}

async function remove(id) {
  // goals/tasks used to cascade via SQLite's FOREIGN KEY ... ON DELETE CASCADE;
  // Mongo has no equivalent, so it's done explicitly here.
  await goalsDb.removeByProject(id);
  await tasksDb.removeByProject(id);
  await collection().deleteOne({ id });
}

module.exports = { listByUser, findById, findByIdForUser, create, update, remove, attachChildren };
