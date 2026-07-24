const { nanoid } = require("nanoid");
const { getDb } = require("../db/mongodb");

function users() {
  return getDb().collection("users");
}

async function findByEmail(email) {
  return await users().findOne({ email });
}

async function findById(id) {
  return await users().findOne({ id });
}

async function create({ email, passwordHash, name }) {
  const user = {
    id: nanoid(),
    email,
    passwordHash,
    name: name || null,
    createdAt: new Date(),
  };

  await users().insertOne(user);

  return user;
}

function toPublic(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

module.exports = {
  findByEmail,
  findById,
  create,
  toPublic,
};