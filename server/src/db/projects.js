const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");
const goalsDb = require("./goals");
const tasksDb = require("./tasks");
const commentsDb = require("./comments");
const activityLogDb = require("./activityLog");
const filesDb = require("./files");
const milestonesDb = require("./milestones");

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
  const [goals, tasks, milestones] = await Promise.all([
    goalsDb.listByProject(project.id),
    tasksDb.listByProject(project.id),
    milestonesDb.listByProject(project.id),
  ]);
  return { ...project, goals, tasks, milestones };
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

// Builds the "can this caller see this project" condition as a single $or
// clause: full visibility in owner/admin workspaces, but in a workspace
// where the caller is only a Member, restricted to projects they created
// or were explicitly granted access to via memberAccess.
function visibilityOr({ fullAccessWorkspaceIds = [], restrictedWorkspaceIds = [], userId }) {
  const clauses = [];
  if (fullAccessWorkspaceIds.length > 0) {
    clauses.push({ workspaceId: { $in: fullAccessWorkspaceIds } });
  }
  if (restrictedWorkspaceIds.length > 0) {
    clauses.push({
      workspaceId: { $in: restrictedWorkspaceIds },
      $or: [{ userId }, { memberAccess: userId }],
    });
  }
  return clauses;
}

// options: { search, tags, priority, archived, sort }
// access: { fullAccessWorkspaceIds, restrictedWorkspaceIds, userId }
async function listForCaller(access, options = {}) {
  const { search, tags, priority, archived = false, sort = "newest" } = options;
  const visibility = visibilityOr(access);
  if (visibility.length === 0) return [];

  const and = [{ $or: visibility }];

  if (archived === true) {
    and.push({ archived: true });
  } else if (archived !== "all") {
    and.push({ archived: { $ne: true } });
  }

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    and.push({ $or: [{ name: regex }, { description: regex }] });
  }

  if (tags && tags.length > 0) {
    and.push({ tags: { $in: tags } });
  }

  if (priority) {
    and.push({ priority });
  }

  const docs = await collection().find({ $and: and }).toArray();
  const projects = await Promise.all(docs.map(toProject).map(attachChildren));
  return sortProjects(projects, sort);
}

async function findById(id) {
  return toProject(await collection().findOne({ id }));
}

// Visible only if the caller has full access to the project's workspace, or
// (in a workspace where they're only a Member) they created it or were
// explicitly granted access.
async function findByIdForCaller(id, access) {
  const visibility = visibilityOr(access);
  if (visibility.length === 0) return null;
  const project = toProject(await collection().findOne({ id, $or: visibility }));
  return project ? attachChildren(project) : null;
}

async function create({ workspaceId, userId, name, description, tags, priority, dueDate, memberAccess }) {
  const project = {
    id: nanoid(),
    workspaceId,
    userId, // the creator — kept for attribution, and for Member-level visibility (see visibilityOr)
    name,
    description,
    tags: Array.isArray(tags) ? tags : [],
    priority: priority || "medium",
    dueDate: dueDate || null,
    archived: false,
    // Explicit per-project grants for Members in a workspace where they
    // don't have blanket (owner/admin) visibility. Irrelevant for
    // owner/admin viewers, who see everything regardless of this list.
    memberAccess: Array.isArray(memberAccess) ? memberAccess : [],
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(project);
  return attachChildren(toProject(project));
}

async function grantAccess(id, userId) {
  await collection().updateOne({ id }, { $addToSet: { memberAccess: userId } });
  return attachChildren(await findById(id));
}

async function revokeAccess(id, userId) {
  await collection().updateOne({ id }, { $pull: { memberAccess: userId } });
  return attachChildren(await findById(id));
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
  await commentsDb.removeByProject(id);
  await activityLogDb.removeByProject(id);
  await filesDb.removeByProject(id);
  await milestonesDb.removeByProject(id);
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
    await commentsDb.removeByProject(doc.id);
    await activityLogDb.removeByProject(doc.id);
    await filesDb.removeByProject(doc.id);
    await milestonesDb.removeByProject(doc.id);
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
  listForCaller,
  findById,
  findByIdForCaller,
  create,
  update,
  remove,
  removeByWorkspace,
  backfillMissingWorkspace,
  grantAccess,
  revokeAccess,
  attachChildren,
};
