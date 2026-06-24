const { nanoid } = require("nanoid");
const db = require("./database");

function listByProject(projectId) {
  const stmt = db.prepare("SELECT * FROM tasks WHERE projectId = ? ORDER BY createdAt ASC");
  return stmt.all(projectId);
}

function findById(id) {
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  return stmt.get(id) || null;
}

function findByIdInProject(id, projectId) {
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ? AND projectId = ?");
  return stmt.get(id, projectId) || null;
}

function create({ projectId, title, notes, goalId, status, dueDate, completedAt }) {
  const id = nanoid();
  const stmt = db.prepare(`
    INSERT INTO tasks (id, projectId, title, notes, goalId, status, dueDate, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, projectId, title, notes, goalId || null, status, dueDate || null, completedAt || null);
  return findById(id);
}

function update(id, fields) {
  const allowed = ["title", "notes", "goalId", "status", "dueDate", "completedAt"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields[k] === undefined ? null : fields[k]));
  const stmt = db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);
  return findById(id);
}

function unlinkGoal(goalId) {
  const stmt = db.prepare("UPDATE tasks SET goalId = NULL WHERE goalId = ?");
  stmt.run(goalId);
}

function remove(id) {
  const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
  stmt.run(id);
}

module.exports = { listByProject, findById, findByIdInProject, create, update, unlinkGoal, remove };
