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
// workspaceIds: every workspace the requesting user is an active member of —
// a project is visible if it belongs to any of them.
async function listByWorkspaces(workspaceIds, options = {}) {
  const { search, tags, priority, archived = false, sort = "newest" } = options;

  if (!workspaceIds || workspaceIds.length === 0) return [];

  const filter = { workspaceId: { $in: workspaceIds } };

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

// Visible only if the project's workspace is one the caller belongs to.
async function findByIdInWorkspaces(id, workspaceIds) {
  if (!workspaceIds || workspaceIds.length === 0) return null;
  const project = toProject(await collection().findOne({ id, workspaceId: { $in: workspaceIds } }));
  return project ? attachChildren(project) : null;
}

async function create({ workspaceId, userId, name, description, tags, priority, dueDate }) {
  const project = {
    id: nanoid(),
    workspaceId,
    userId, // the creator — kept for attribution, access control now goes through workspace membership
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

// Used when a whole workspace is deleted (currently: a user's personal
// workspace, when they delete their account) — removes every project in it,
// cascading to each project's goals/tasks the same way remove() does.
async function removeByWorkspace(workspaceId) {
  const docs = await collection().find({ workspaceId }, { projection: { id: 1 } }).toArray();
  for (const doc of docs) {
    await goalsDb.removeByProject(doc.id);
    await tasksDb.removeByProject(doc.id);
  }
  await collection().deleteMany({ workspaceId });
}

// One-time-per-project migration: projects created before workspaces existed
// have userId but no workspaceId. Backfills them into that user's personal
// workspace. Safe to call repeatedly — a no-op once nothing is missing it.
async function backfillMissingWorkspace(userId, workspaceId) {
  await collection().updateMany(
    { userId, workspaceId: { $exists: false } },
    { $set: { workspaceId } }
  );
}

module.exports = {
  listByWorkspaces,
  findById,
  findByIdInWorkspaces,
  create,
  update,
  remove,
  removeByWorkspace,
  backfillMissingWorkspace,
  attachChildren,
};
