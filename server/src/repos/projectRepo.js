const { nanoid } = require("nanoid");
const { getDb } = require("../db/mongodb");

function projects() {
  return getDb().collection("projects");
}

async function listByUser(userId) {
  return await projects()
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();
}

async function findById(id) {
  return await projects().findOne({ id });
}

async function findByIdForUser(id, userId) {
  return await projects().findOne({ id, userId });
}

async function create({ userId, name, description }) {
  const project = {
    id: nanoid(),
    userId,
    name,
    description,
    createdAt: new Date(),
  };

  await projects().insertOne(project);
  return project;
}

async function update(id, fields) {
  await projects().updateOne(
    { id },
    { $set: fields }
  );

  return findById(id);
}

async function remove(id) {
  await projects().deleteOne({ id });
}

module.exports = {
  listByUser,
  findById,
  findByIdForUser,
  create,
  update,
  remove,
};