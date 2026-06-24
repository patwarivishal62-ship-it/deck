const { nanoid } = require("nanoid");
const db = require("./database");
const goalsDb = require("./goals");
const tasksDb = require("./tasks");

function attachChildren(project) {
  if (!project) return null;
  return {
    ...project,
    goals: goalsDb.listByProject(project.id),
    tasks: tasksDb.listByProject(project.id),
  };
}

function listByUser(userId) {
  const stmt = db.prepare("SELECT * FROM projects WHERE userId = ? ORDER BY createdAt ASC");
  return stmt.all(userId).map(attachChildren);
}

function findById(id) {
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ?");
  return stmt.get(id) || null;
}

function findByIdForUser(id, userId) {
  const stmt = db.prepare("SELECT * FROM projects WHERE id = ? AND userId = ?");
  const project = stmt.get(id, userId);
  return project ? attachChildren(project) : null;
}

function create({ userId, name, description }) {
  const id = nanoid();
  const stmt = db.prepare("INSERT INTO projects (id, userId, name, description) VALUES (?, ?, ?, ?)");
  stmt.run(id, userId, name, description);
  return attachChildren(findById(id));
}

function update(id, fields) {
  const allowed = ["name", "description"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return attachChildren(findById(id));

  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  const stmt = db.prepare(`UPDATE projects SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);
  return attachChildren(findById(id));
}

function remove(id) {
  // goals/tasks cascade via FOREIGN KEY ... ON DELETE CASCADE
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  stmt.run(id);
}

module.exports = { listByUser, findById, findByIdForUser, create, update, remove, attachChildren };
