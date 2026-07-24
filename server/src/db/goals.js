const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("goals");
}

function toGoal(doc) {
  if (!doc) return null;
  const { _id, ...goal } = doc;
  return goal;
}

// Goals have no createdAt column in the original schema — they were ordered
// by SQLite's implicit rowid (insertion order). Mongo's ObjectId is
// monotonically increasing, so sorting by _id reproduces the same order.
async function listByProject(projectId) {
  const docs = await collection().find({ projectId }).sort({ _id: 1 }).toArray();
  return docs.map(toGoal);
}

async function findById(id) {
  return toGoal(await collection().findOne({ id }));
}

async function findByIdInProject(id, projectId) {
  return toGoal(await collection().findOne({ id, projectId }));
}

async function create({ projectId, category, platform, label, targetValue, currentValue, unit, period, step }) {
  const goal = {
    id: nanoid(),
    projectId,
    category,
    platform,
    label,
    targetValue,
    currentValue,
    unit,
    period,
    step,
  };
  await collection().insertOne(goal);
  return toGoal(goal);
}

// Builds a $set only for the fields actually present in `fields`.
async function update(id, fields) {
  const allowed = ["category", "platform", "label", "targetValue", "currentValue", "unit", "period", "step"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return findById(id);
}

async function setCurrentValue(id, currentValue) {
  await collection().updateOne({ id }, { $set: { currentValue } });
  return findById(id);
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
  setCurrentValue,
  remove,
  removeByProject,
};
