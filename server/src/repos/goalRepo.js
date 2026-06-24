const { nanoid } = require("nanoid");
const db = require("../db/connection");

function listByProject(projectId) {
  return db.prepare("SELECT * FROM goals WHERE projectId = ? ORDER BY rowid ASC").all(projectId);
}

function findById(id) {
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id);
}

function findInProject(id, projectId) {
  return db.prepare("SELECT * FROM goals WHERE id = ? AND projectId = ?").get(id, projectId);
}

function create({ projectId, category, platform, label, targetValue, currentValue, unit, period, step }) {
  const id = nanoid();
  db.prepare(
    `INSERT INTO goals (id, projectId, category, platform, label, targetValue, currentValue, unit, period, step)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectId, category, platform, label, targetValue, currentValue, unit, period, step);
  return findById(id);
}

function update(id, fields) {
  const current = findById(id);
  if (!current) return null;
  const next = { ...current, ...fields };
  db.prepare(
    `UPDATE goals SET category = ?, platform = ?, label = ?, targetValue = ?, currentValue = ?,
     unit = ?, period = ?, step = ? WHERE id = ?`
  ).run(
    next.category,
    next.platform,
    next.label,
    next.targetValue,
    next.currentValue,
    next.unit,
    next.period,
    next.step,
    id
  );
  return findById(id);
}

function setCurrentValue(id, currentValue) {
  db.prepare("UPDATE goals SET currentValue = ? WHERE id = ?").run(currentValue, id);
  return findById(id);
}

function remove(id) {
  db.prepare("UPDATE tasks SET goalId = NULL WHERE goalId = ?").run(id);
  db.prepare("DELETE FROM goals WHERE id = ?").run(id);
}

module.exports = { listByProject, findById, findInProject, create, update, setCurrentValue, remove };
