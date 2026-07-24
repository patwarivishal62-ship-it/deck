const { nanoid } = require("nanoid");
const { getDb } = require("../db/mongodb");

function goals() {
  return getDb().collection("goals");
}

async function listByProject(projectId) {
  return await goals()
    .find({ projectId })
    .sort({ createdAt: 1 })
    .toArray();
}

async function findById(id) {
  return await goals().findOne({ id });
}

async function findInProject(id, projectId) {
  return await goals().findOne({ id, projectId });
}

async function create({
  projectId,
  category,
  platform,
  label,
  targetValue,
  currentValue,
  unit,
  period,
  step,
}) {
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
    createdAt: new Date(),
  };

  await goals().insertOne(goal);
  return goal;
}

async function update(id, fields) {
  await goals().updateOne(
    { id },
    { $set: fields }
  );

  return findById(id);
}

async function setCurrentValue(id, currentValue) {
  await goals().updateOne(
    { id },
    { $set: { currentValue } }
  );

  return findById(id);
}

async function remove(id) {
  await getDb().collection("tasks").updateMany(
    { goalId: id },
    { $set: { goalId: null } }
  );

  await goals().deleteOne({ id });
}

module.exports = {
  listByProject,
  findById,
  findInProject,
  create,
  update,
  setCurrentValue,
  remove,
};