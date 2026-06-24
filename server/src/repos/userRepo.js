const { nanoid } = require("nanoid");
const db = require("../db/connection");

function findByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function findById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function create({ email, passwordHash, name }) {
  const id = nanoid();
  db.prepare("INSERT INTO users (id, email, passwordHash, name) VALUES (?, ?, ?, ?)").run(
    id,
    email,
    passwordHash,
    name || null
  );
  return findById(id);
}

function toPublic(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

module.exports = { findByEmail, findById, create, toPublic };
