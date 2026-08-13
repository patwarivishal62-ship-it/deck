const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("metrics");
}

function toMetric(doc) {
  if (!doc) return null;
  const { _id, ...metric } = doc;
  return metric;
}

async function listByProject(projectId) {
  const docs = await collection().find({ projectId }).sort({ createdAt: 1 }).toArray();
  return docs.map(toMetric);
}

async function findByIdInProject(id, projectId) {
  return toMetric(await collection().findOne({ id, projectId }));
}

async function create({ projectId, createdBy, category, key, label, unit }) {
  const metric = {
    id: nanoid(),
    projectId,
    createdBy,
    category,
    key: key || null, // matches a METRIC_CATALOG entry when picked from the list, null for a custom metric
    label,
    unit,
    entries: [],
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(metric);
  return toMetric(metric);
}

async function update(id, fields) {
  const allowed = ["label", "unit"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return toMetric(await collection().findOne({ id }));

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return toMetric(await collection().findOne({ id }));
}

async function remove(id) {
  await collection().deleteOne({ id });
}

async function removeByProject(projectId) {
  await collection().deleteMany({ projectId });
}

// Entries are logged data points: { id, date, value, note }. Kept newest
// last so charts/lists can render in chronological order without re-sorting.
async function addEntry(id, { date, value, note, loggedBy }) {
  const entry = {
    id: nanoid(),
    date,
    value,
    note: note || "",
    loggedBy,
    createdAt: new Date().toISOString(),
  };
  await collection().updateOne({ id }, { $push: { entries: entry } });
  return toMetric(await collection().findOne({ id }));
}

async function removeEntry(id, entryId) {
  await collection().updateOne({ id }, { $pull: { entries: { id: entryId } } });
  return toMetric(await collection().findOne({ id }));
}

module.exports = {
  listByProject,
  findByIdInProject,
  create,
  update,
  remove,
  removeByProject,
  addEntry,
  removeEntry,
};
