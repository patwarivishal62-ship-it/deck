const { nanoid } = require("nanoid");
const db = require("./database");

function findByEmail(email) {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  return stmt.get(email) || null;
}

function findById(id) {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id) || null;
}

function create({ email, passwordHash, name }) {
  const id = nanoid();
  const stmt = db.prepare(
    "INSERT INTO users (id, email, passwordHash, name) VALUES (?, ?, ?, ?)"
  );
  stmt.run(id, email, passwordHash, name || null);
  return findById(id);
}

module.exports = { findByEmail, findById, create };
