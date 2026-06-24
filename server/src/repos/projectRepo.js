const { nanoid } = require("nanoid");
const db = require("../db/connection");
const { listByProject: listGoalsByProject } = require("./goalRepo");
const { listByProject: listTasksByProject } = require("./taskRepo");

function hydrate(project) {
  if (!project) return null;
  return {
    ...project,
    goals: listGoalsByProject(project.id),
    tasks: listTasksByProject(project.id),
  };
}

function listByUser(userId) {
  const rows = db
    .prepare("SELECT * FROM projects WHERE userId = ? ORDER BY createdAt ASC")
    .all(userId);
  return rows.map(hydrate);
}

function findOwned(id, userId) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ? AND userId = ?").get(id, userId);
  return hydrate(row);
}

// Same as findOwned but without goals/tasks — used internally by goal/task repos
// to check ownership without recursive hydration.
function findOwnedRaw(id, userId) {
  return db.prepare("SELECT * FROM projects WHERE id = ? AND userId = ?").get(id, userId);
}

function create({ name, description, userId }) {
  const id = nanoid();
  db.prepare("INSERT INTO projects (id, name, description, userId) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    description || "",
    userId
  );
  return findOwned(id, userId);
}

function update(id, userId, fields) {
  const current = findOwnedRaw(id, userId);
  if (!current) return null;

  const next = {
    name: fields.name !== undefined ? fields.name : current.name,
    description: fields.description !== undefined ? fields.description : current.description,
  };
  db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?").run(
    next.name,
    next.description,
    id
  );
  return findOwned(id, userId);
}

function remove(id, userId) {
  const current = findOwnedRaw(id, userId);
  if (!current) return false;
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return true;
}

module.exports = { listByUser, findOwned, findOwnedRaw, create, update, remove };
