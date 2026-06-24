const { nanoid } = require("nanoid");
const db = require("../db/connection");

function listByProject(projectId) {
  return db.prepare("SELECT * FROM tasks WHERE projectId = ? ORDER BY createdAt ASC").all(projectId);
}

function findById(id) {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
}

function findInProject(id, projectId) {
  return db.prepare("SELECT * FROM tasks WHERE id = ? AND projectId = ?").get(id, projectId);
}

function create({ projectId, goalId, title, notes, status, dueDate }) {
  const id = nanoid();
  const completedAt = status === "done" ? new Date().toISOString() : null;
  db.prepare(
    `INSERT INTO tasks (id, projectId, goalId, title, notes, status, dueDate, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectId, goalId || null, title, notes || "", status || "todo", dueDate || null, completedAt);
  return findById(id);
}

function update(id, fields) {
  const current = findById(id);
  if (!current) return null;
  const next = { ...current, ...fields };
  const completedAt =
    next.status === "done" ? current.completedAt || new Date().toISOString() : null;

  db.prepare(
    `UPDATE tasks SET goalId = ?, title = ?, notes = ?, status = ?, dueDate = ?, completedAt = ? WHERE id = ?`
  ).run(next.goalId || null, next.title, next.notes, next.status, next.dueDate || null, completedAt, id);
  return findById(id);
}

function remove(id) {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

module.exports = { listByProject, findById, findInProject, create, update, remove };
