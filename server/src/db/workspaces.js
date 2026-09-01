const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");
const membershipsDb = require("./memberships");

function collection() {
  return getDb().collection("workspaces");
}

function toWorkspace(doc) {
  if (!doc) return null;
  const { _id, ...workspace } = doc;
  return workspace;
}

async function findById(id) {
  return toWorkspace(await collection().findOne({ id }));
}

async function findManyByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const docs = await collection().find({ id: { $in: ids } }).toArray();
  return docs.map(toWorkspace);
}

async function create({ name, ownerId, personal = false }) {
  const workspace = {
    id: nanoid(),
    name,
    ownerId,
    personal,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(workspace);
  return toWorkspace(workspace);
}

async function findPersonalByOwner(ownerId) {
  return toWorkspace(await collection().findOne({ ownerId, personal: true }));
}

async function updateName(id, name) {
  await collection().updateOne({ id }, { $set: { name } });
  return findById(id);
}

async function remove(id) {
  await collection().deleteOne({ id });
}

// Creates a personal workspace + owner membership for a user the first time
// they need one — called right after signup, and defensively for any
// pre-existing user who doesn't have one yet (e.g. accounts created before
// this feature existed).
async function ensurePersonal(userId, displayName) {
  const existing = await findPersonalByOwner(userId);
  if (existing) return existing;

  const workspace = await create({
    name: displayName ? `${displayName}'s Workspace` : "My Workspace",
    ownerId: userId,
    personal: true,
  });
  await membershipsDb.createActive({ workspaceId: workspace.id, userId, role: "owner" });
  return workspace;
}

module.exports = { findById, findManyByIds, create, findPersonalByOwner, updateName, remove, ensurePersonal };
