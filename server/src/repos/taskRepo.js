const { nanoid } = require("nanoid");
const { getDb } = require("../db/mongodb");

function tasks() {
  return getDb().collection("tasks");
}

async function listByProject(projectId) {
  return await tasks()
    .find({ projectId })
    .sort({ createdAt: 1 })
    .toArray();
}

async function findById(id) {
  return await tasks().findOne({ id });
}

async function findInProject(id, projectId) {
  return await tasks().findOne({ id, projectId });
}

async function create({
  projectId,
  goalId,
  title,
  notes,
  status,
  dueDate,
}) {
  const task = {
    id: nanoid(),
    projectId,
    goalId: goalId || null,
    title,
    notes: notes || "",
    status: status || "todo",
    dueDate: dueDate || null,
    completedAt: status === "done" ? new Date() : null,
    createdAt: new Date(),
  };

  await tasks().insertOne(task);

  return task;
}

async function update(id, fields) {
  const current = await findById(id);
  if (!current) return null;

  const next = {
    ...current,
    ...fields,
  };

  next.completedAt =
    next.status === "done"
      ? current.completedAt || new Date()
      : null;

  await tasks().updateOne(
    { id },
    { $set: next }
  );

  return await findById(id);
}

async function remove(id) {
  await tasks().deleteOne({ id });
}

module.exports = {
  listByProject,
  findById,
  findInProject,
  create,
  update,
  remove,
};