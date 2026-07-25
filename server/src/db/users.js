const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("users");
}

function toUser(doc) {
  if (!doc) return null;
  const { _id, ...user } = doc;
  return user;
}

async function findByEmail(email) {
  return toUser(await collection().findOne({ email }));
}

async function findById(id) {
  return toUser(await collection().findOne({ id }));
}

async function create({ email, passwordHash, name }) {
  const user = {
    id: nanoid(),
    email,
    passwordHash,
    name: name || null,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(user);
  return toUser(user);
}

async function updateName(id, name) {
  await collection().updateOne({ id }, { $set: { name: name || null } });
  return findById(id);
}

async function updatePasswordHash(id, passwordHash) {
  await collection().updateOne({ id }, { $set: { passwordHash } });
}

module.exports = { findByEmail, findById, create, updateName, updatePasswordHash };
