const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("deletionRequests");
}

function toRequest(doc) {
  if (!doc) return null;
  const { _id, ...request } = doc;
  return request;
}

// Kept as an audit trail of account deletions (who, when, why) even though
// deletion is now immediate rather than going through manual review — the
// record documents that it happened.
async function create({ userId, fullName, email, reason }) {
  const request = {
    id: nanoid(),
    userId,
    fullName: fullName || null,
    email,
    reason: reason || "",
    requestedAt: new Date().toISOString(),
    status: "approved",
  };
  await collection().insertOne(request);
  return toRequest(request);
}

module.exports = { create };
