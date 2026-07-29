const membershipsDb = require("../db/memberships");
const usersDb = require("../db/users");

// Everyone who can actually see this specific project: every workspace
// Owner/Admin (they see all projects), plus Members who've been explicitly
// granted access to this one. Used both for the @mention dropdown/validation
// and for who's eligible to be assigned a task in this project.
async function collaboratorsFor(project) {
  const memberships = (await membershipsDb.listByWorkspace(project.workspaceId)).filter(
    (m) => m.status === "active"
  );
  const eligible = memberships.filter(
    (m) => m.role === "owner" || m.role === "admin" || (project.memberAccess || []).includes(m.userId)
  );
  const users = await Promise.all(eligible.map((m) => usersDb.findById(m.userId)));
  return eligible.map((m, i) => ({ userId: m.userId, name: users[i]?.name, email: users[i]?.email }));
}

module.exports = { collaboratorsFor };
