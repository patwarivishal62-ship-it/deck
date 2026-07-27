const express = require("express");
const crypto = require("crypto");
const usersDb = require("../db/users");
const workspacesDb = require("../db/workspaces");
const membershipsDb = require("../db/memberships");
const { requireAuth } = require("../middleware/auth");
const { attachWorkspaces } = require("../middleware/workspace");
const { sendWorkspaceInviteEmail } = require("../lib/email");

const router = express.Router();

// GET /api/workspaces/invites/preview?token=... — used by the accept page to
// show who invited them and to which workspace, BEFORE they've signed in —
// intentionally placed above requireAuth below, since this must be public.
router.get("/invites/preview", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Missing token." });

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const invite = await membershipsDb.findByInviteTokenHash(tokenHash);
  if (!invite || invite.status !== "pending") {
    return res.status(404).json({ error: "This invite is invalid or has already been used." });
  }

  const workspace = await workspacesDb.findById(invite.workspaceId);
  res.json({ email: invite.email, workspaceName: workspace?.name, role: invite.role });
});

router.use(requireAuth);
router.use(attachWorkspaces);

function roleFor(req, workspaceId) {
  return req.workspaces.find((w) => w.id === workspaceId)?.role;
}

// GET /api/workspaces — every workspace the caller belongs to, with role
router.get("/", async (req, res) => {
  res.json({ workspaces: req.workspaces });
});

// POST /api/workspaces — create an additional (non-personal) workspace; caller becomes owner
router.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Workspace name is required." });
  }
  const workspace = await workspacesDb.create({ name: name.trim(), ownerId: req.userId, personal: false });
  await membershipsDb.createActive({ workspaceId: workspace.id, userId: req.userId, role: "owner" });
  res.status(201).json({ workspace: { ...workspace, role: "owner" } });
});

// GET /api/workspaces/:id/members — active members + pending invites
router.get("/:id/members", async (req, res) => {
  const role = roleFor(req, req.params.id);
  if (!role) return res.status(404).json({ error: "Workspace not found." });

  const memberships = await membershipsDb.listByWorkspace(req.params.id);
  const activeUserIds = memberships.filter((m) => m.userId).map((m) => m.userId);
  const users = await Promise.all(activeUserIds.map((id) => usersDb.findById(id)));
  const userById = {};
  users.forEach((u) => u && (userById[u.id] = u));

  const members = memberships.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    email: m.userId ? userById[m.userId]?.email : m.email,
    name: m.userId ? userById[m.userId]?.name : null,
    invitedAt: m.invitedAt,
    joinedAt: m.joinedAt,
  }));

  res.json({ members });
});

// POST /api/workspaces/:id/invite  { email, role } — Admin/Owner only
router.post("/:id/invite", async (req, res) => {
  const role = roleFor(req, req.params.id);
  if (!role) return res.status(404).json({ error: "Workspace not found." });
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only admins or owners can invite people." });
  }

  const { email, role: inviteRole } = req.body || {};
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required." });
  }
  if (!["admin", "member"].includes(inviteRole)) {
    return res.status(400).json({ error: "Invite role must be 'admin' or 'member'." });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await usersDb.findByEmail(normalizedEmail);
  if (existingUser) {
    const existingMembership = await membershipsDb.findActive(req.params.id, existingUser.id);
    if (existingMembership) {
      return res.status(409).json({ error: "That person is already a member of this workspace." });
    }
  }

  const existingPending = await membershipsDb.findPendingByWorkspaceAndEmail(req.params.id, normalizedEmail);
  if (existingPending) {
    return res.status(409).json({ error: "There's already a pending invite for that email." });
  }

  const workspace = req.workspaces.find((w) => w.id === req.params.id);
  const inviter = await usersDb.findById(req.userId);

  const { membership, rawToken } = await membershipsDb.createInvite({
    workspaceId: req.params.id,
    email: normalizedEmail,
    role: inviteRole,
    invitedBy: req.userId,
  });

  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
  const inviteUrl = `${clientOrigin}/invite/accept?token=${rawToken}`;

  try {
    await sendWorkspaceInviteEmail({
      to: normalizedEmail,
      workspaceName: workspace?.name || "a Deck workspace",
      inviterName: inviter?.name || inviter?.email,
      inviteUrl,
    });
  } catch (emailErr) {
    console.error("Failed to send workspace invite email:", emailErr);
  }

  res.status(201).json({ membership });
});

// POST /api/workspaces/invites/accept  { token } — requires the signed-in
// user's email to match the invite's email
router.post("/invites/accept", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing token." });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await membershipsDb.findByInviteTokenHash(tokenHash);
  if (!invite || invite.status !== "pending") {
    return res.status(400).json({ error: "This invite is invalid or has already been used." });
  }

  const user = await usersDb.findById(req.userId);
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return res.status(403).json({ error: "This invite was sent to a different email address." });
  }

  const membership = await membershipsDb.acceptInvite(invite.id, user.id);
  res.json({ membership });
});

// PATCH /api/workspaces/:id/members/:membershipId  { role } — Owner only
router.patch("/:id/members/:membershipId", async (req, res) => {
  const role = roleFor(req, req.params.id);
  if (!role) return res.status(404).json({ error: "Workspace not found." });
  if (role !== "owner") {
    return res.status(403).json({ error: "Only the workspace owner can change roles." });
  }

  const { role: newRole } = req.body || {};
  if (!["owner", "admin", "member"].includes(newRole)) {
    return res.status(400).json({ error: "Invalid role." });
  }

  const target = await membershipsDb.findById(req.params.membershipId);
  if (!target || target.workspaceId !== req.params.id) {
    return res.status(404).json({ error: "Member not found." });
  }

  if (target.role === "owner" && newRole !== "owner") {
    const ownerCount = await membershipsDb.countByRole(req.params.id, "owner");
    if (ownerCount <= 1) {
      return res.status(400).json({ error: "A workspace needs at least one owner." });
    }
  }

  const updated = await membershipsDb.updateRole(target.id, newRole);
  res.json({ membership: updated });
});

// DELETE /api/workspaces/:id/members/:membershipId — Admin+ (can't remove an owner)
router.delete("/:id/members/:membershipId", async (req, res) => {
  const role = roleFor(req, req.params.id);
  if (!role) return res.status(404).json({ error: "Workspace not found." });
  if (!membershipsDb.hasAtLeastRole(role, "admin")) {
    return res.status(403).json({ error: "Only admins or owners can remove members." });
  }

  const target = await membershipsDb.findById(req.params.membershipId);
  if (!target || target.workspaceId !== req.params.id) {
    return res.status(404).json({ error: "Member not found." });
  }
  if (target.role === "owner") {
    return res.status(400).json({ error: "Remove or reassign the owner role before removing this member." });
  }

  await membershipsDb.remove(target.id);
  res.json({ ok: true });
});

module.exports = router;
