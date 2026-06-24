const { nanoid } = require("nanoid");
const db = require("./database");

function listByProject(projectId) {
  const stmt = db.prepare("SELECT * FROM goals WHERE projectId = ? ORDER BY rowid ASC");
  return stmt.all(projectId);
}

function findById(id) {
  const stmt = db.prepare("SELECT * FROM goals WHERE id = ?");
  return stmt.get(id) || null;
}

function findByIdInProject(id, projectId) {
  const stmt = db.prepare("SELECT * FROM goals WHERE id = ? AND projectId = ?");
  return stmt.get(id, projectId) || null;
}

function create({ projectId, category, platform, label, targetValue, currentValue, unit, period, step }) {
  const id = nanoid();
  const stmt = db.prepare(`
    INSERT INTO goals (id, projectId, category, platform, label, targetValue, currentValue, unit, period, step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, projectId, category, platform, label, targetValue, currentValue, unit, period, step);
  return findById(id);
}

// Builds an UPDATE statement only for the fields actually present in `fields`.
function update(id, fields) {
  const allowed = ["category", "platform", "label", "targetValue", "currentValue", "unit", "period", "step"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k]);
  const stmt = db.prepare(`UPDATE goals SET ${setClause} WHERE id = ?`);
  stmt.run(...values, id);
  return findById(id);
}

function setCurrentValue(id, currentValue) {
  const stmt = db.prepare("UPDATE goals SET currentValue = ? WHERE id = ?");
  stmt.run(currentValue, id);
  return findById(id);
}

function remove(id) {
  const stmt = db.prepare("DELETE FROM goals WHERE id = ?");
  stmt.run(id);
}

module.exports = { listByProject, findById, findByIdInProject, create, update, setCurrentValue, remove };
