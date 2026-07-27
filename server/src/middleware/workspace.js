const usersDb = require("../db/users");
const workspacesDb = require("../db/workspaces");
const membershipsDb = require("../db/memberships");
const projectsDb = require("../db/projects");

// Runs after requireAuth. Attaches:
//   req.workspaces               — [{ ...workspace, role }] for every
//                                  workspace the user is an active member of
//   req.workspaceIds             — just the ids
//   req.fullAccessWorkspaceIds   — workspaces where role is owner/admin —
//                                  the caller sees every project in these
//   req.restrictedWorkspaceIds   — workspaces where role is member — the
//                                  caller only sees projects they created or
//                                  were explicitly given access to
//
// Also lazily creates a personal workspace the first time a user needs one
// (covers both brand-new signups and any pre-existing account from before
// workspaces existed), and backfills any of that user's projects that
// predate workspaces into it. Both steps are cheap no-ops once already done.
async function attachWorkspaces(req, res, next) {
  try {
    const user = await usersDb.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Not signed in." });

    const personal = await workspacesDb.ensurePersonal(user.id, user.name);
    await projectsDb.backfillMissingWorkspace(user.id, personal.id);

    const memberships = await membershipsDb.listActiveByUser(user.id);
    const workspaces = await workspacesDb.findManyByIds(memberships.map((m) => m.workspaceId));

    const roleByWorkspaceId = {};
    memberships.forEach((m) => (roleByWorkspaceId[m.workspaceId] = m.role));

    req.workspaces = workspaces.map((w) => ({ ...w, role: roleByWorkspaceId[w.id] }));
    req.workspaceIds = req.workspaces.map((w) => w.id);
    req.fullAccessWorkspaceIds = req.workspaces
      .filter((w) => w.role === "owner" || w.role === "admin")
      .map((w) => w.id);
    req.restrictedWorkspaceIds = req.workspaces.filter((w) => w.role === "member").map((w) => w.id);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not resolve workspaces." });
  }
}

module.exports = { attachWorkspaces };
