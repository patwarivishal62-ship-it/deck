const { nanoid } = require("nanoid");
const crypto = require("crypto");
const { getDb } = require("./mongodb");

const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

function collection() {
  return getDb().collection("memberships");
}

function toMembership(doc) {
  if (!doc) return null;
  const { _id, inviteTokenHash, ...membership } = doc;
  return membership;
}

function hasAtLeastRole(role, minRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[minRole] ?? Infinity);
}

// The membership a specific user has in a specific workspace, active only.
async function findActive(workspaceId, userId) {
  return toMembership(await collection().findOne({ workspaceId, userId, status: "active" }));
}

// Every active workspace membership for a user, used to resolve "which
// workspaces (and with what role) can this user act in."
async function listActiveByUser(userId) {
  const docs = await collection().find({ userId, status: "active" }).toArray();
  return docs.map(toMembership);
}

// All memberships (active + pending) in a workspace, for the members list.
async function listByWorkspace(workspaceId) {
  const docs = await collection().find({ workspaceId }).sort({ invitedAt: 1 }).toArray();
  return docs.map(toMembership);
}

async function findById(id) {
  return toMembership(await collection().findOne({ id }));
}

async function createActive({ workspaceId, userId, role }) {
  const membership = {
    id: nanoid(),
    workspaceId,
    userId,
    email: null,
    role,
    status: "active",
    invitedBy: userId,
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
  };
  await collection().insertOne(membership);
  return toMembership(membership);
}

// Creates a pending invite and returns both the membership and the raw
// (unhashed) token — the raw token only ever exists here and in the emailed
// link, never stored.
async function createInvite({ workspaceId, email, role, invitedBy }) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const inviteTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const membership = {
    id: nanoid(),
    workspaceId,
    userId: null,
    email: email.toLowerCase().trim(),
    role,
    status: "pending",
    invitedBy,
    invitedAt: new Date().toISOString(),
    joinedAt: null,
    inviteTokenHash,
  };
  await collection().insertOne(membership);
  return { membership: toMembership(membership), rawToken };
}

async function findByInviteTokenHash(inviteTokenHash) {
  const doc = await collection().findOne({ inviteTokenHash });
  if (!doc) return null;
  return { ...toMembership(doc), email: doc.email };
}

async function acceptInvite(id, userId) {
  await collection().updateOne(
    { id },
    { $set: { userId, status: "active", joinedAt: new Date().toISOString() }, $unset: { inviteTokenHash: "" } }
  );
  return findById(id);
}

async function findPendingByWorkspaceAndEmail(workspaceId, email) {
  return toMembership(
    await collection().findOne({ workspaceId, email: email.toLowerCase().trim(), status: "pending" })
  );
}

async function updateRole(id, role) {
  await collection().updateOne({ id }, { $set: { role } });
  return findById(id);
}

async function remove(id) {
  await collection().deleteOne({ id });
}

// Used when an account is deleted — removes every membership the user has,
// in their own personal workspace and in any team workspace they'd joined.
// Doesn't touch other members' memberships in shared workspaces.
async function removeAllForUser(userId) {
  await collection().deleteMany({ userId });
}

async function countByRole(workspaceId, role) {
  return collection().countDocuments({ workspaceId, role, status: "active" });
}

module.exports = {
  hasAtLeastRole,
  findActive,
  listActiveByUser,
  listByWorkspace,
  findById,
  createActive,
  createInvite,
  findByInviteTokenHash,
  acceptInvite,
  findPendingByWorkspaceAndEmail,
  updateRole,
  remove,
  removeAllForUser,
  countByRole,
};
