const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("tasks");
}

function toTask(doc) {
  if (!doc) return null;
  const { _id, ...task } = doc;
  return task;
}

async function listByProject(projectId) {
  const docs = await collection().find({ projectId }).sort({ createdAt: 1, _id: 1 }).toArray();
  return docs.map(toTask);
}

async function findById(id) {
  return toTask(await collection().findOne({ id }));
}

async function findByIdInProject(id, projectId) {
  return toTask(await collection().findOne({ id, projectId }));
}

async function create({ projectId, title, notes, goalId, status, dueDate, completedAt }) {
  const task = {
    id: nanoid(),
    projectId,
    title,
    notes,
    goalId: goalId || null,
    status,
    dueDate: dueDate || null,
    createdAt: new Date().toISOString(),
    completedAt: completedAt || null,
  };
  await collection().insertOne(task);
  return toTask(task);
}

async function update(id, fields) {
  const allowed = ["title", "notes", "goalId", "status", "dueDate", "completedAt"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k] === undefined ? null : fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return findById(id);
}

// Replaces SQLite's ON DELETE SET NULL (FOREIGN KEY goalId -> goals.id)
// when a single goal is deleted.
async function unlinkGoal(goalId) {
  await collection().updateMany({ goalId }, { $set: { goalId: null } });
}

async function remove(id) {
  await collection().deleteOne({ id });
}

// Replaces SQLite's ON DELETE CASCADE (FOREIGN KEY projectId -> projects.id)
// when a whole project is deleted.
async function removeByProject(projectId) {
  await collection().deleteMany({ projectId });
}

module.exports = {
  listByProject,
  findById,
  findByIdInProject,
  create,
  update,
  unlinkGoal,
  remove,
  removeByProject,
};
