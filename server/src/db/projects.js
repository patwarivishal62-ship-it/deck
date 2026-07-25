const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");
const goalsDb = require("./goals");
const tasksDb = require("./tasks");

const PRIORITY_RANK = { low: 0, medium: 1, high: 2 };

function collection() {
  return getDb().collection("projects");
}

function toProject(doc) {
  if (!doc) return null;
  const { _id, ...project } = doc;
  return project;
}

async function attachChildren(project) {
  if (!project) return null;
  const [goals, tasks] = await Promise.all([
    goalsDb.listByProject(project.id),
    tasksDb.listByProject(project.id),
  ]);
  return { ...project, goals, tasks };
}

function sortProjects(projects, sort) {
  const sorted = [...projects];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "dueDate":
      // Projects without a due date sort to the end regardless of direction.
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    case "priority":
      return sorted.sort((a, b) => (PRIORITY_RANK[b.priority] ?? 1) - (PRIORITY_RANK[a.priority] ?? 1));
    case "newest":
    default:
      return sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

// options: { search, tags, priority, archived, sort }
// - archived: false (default) excludes archived projects, true shows only
//   archived, "all" shows both
// - tags: array — matches a project that has ANY of the given tags
// - search: case-insensitive match against name or description
async function listByUser(userId, options = {}) {
  const { search, tags, priority, archived = false, sort = "newest" } = options;

  const filter = { userId };

  if (archived === true) {
    filter.archived = true;
  } else if (archived !== "all") {
    filter.archived = { $ne: true };
  }

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { description: regex }];
  }

  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  if (priority) {
    filter.priority = priority;
  }

  const docs = await collection().find(filter).toArray();
  const projects = await Promise.all(docs.map(toProject).map(attachChildren));
  return sortProjects(projects, sort);
}

async function findById(id) {
  return toProject(await collection().findOne({ id }));
}

async function findByIdForUser(id, userId) {
  const project = toProject(await collection().findOne({ id, userId }));
  return project ? attachChildren(project) : null;
}

async function create({ userId, name, description, tags, priority, dueDate }) {
  const project = {
    id: nanoid(),
    userId,
    name,
    description,
    tags: Array.isArray(tags) ? tags : [],
    priority: priority || "medium",
    dueDate: dueDate || null,
    archived: false,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(project);
  return attachChildren(toProject(project));
}

async function update(id, fields) {
  const allowed = ["name", "description", "tags", "priority", "dueDate", "archived"];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return attachChildren(await findById(id));

  const setDoc = {};
  keys.forEach((k) => (setDoc[k] = fields[k]));
  await collection().updateOne({ id }, { $set: setDoc });
  return attachChildren(await findById(id));
}

async function remove(id) {
  // goals/tasks used to cascade via SQLite's FOREIGN KEY ... ON DELETE CASCADE;
  // Mongo has no equivalent, so it's done explicitly here.
  await goalsDb.removeByProject(id);
  await tasksDb.removeByProject(id);
  await collection().deleteOne({ id });
}

// Used when a whole account is deleted — removes every project this user
// owns, cascading to each project's goals and tasks the same way remove() does.
async function removeByUser(userId) {
  const docs = await collection().find({ userId }, { projection: { id: 1 } }).toArray();
  for (const doc of docs) {
    await goalsDb.removeByProject(doc.id);
    await tasksDb.removeByProject(doc.id);
  }
  await collection().deleteMany({ userId });
}

module.exports = { listByUser, findById, findByIdForUser, create, update, remove, removeByUser, attachChildren };
