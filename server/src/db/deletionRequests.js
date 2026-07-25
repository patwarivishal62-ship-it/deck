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

async function create({ userId, fullName, email, reason }) {
  const request = {
    id: nanoid(),
    userId,
    fullName: fullName || null,
    email,
    reason: reason || "",
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  await collection().insertOne(request);
  return toRequest(request);
}

// A user can have at most one open (pending) request at a time.
async function findPendingByUser(userId) {
  return toRequest(await collection().findOne({ userId, status: "pending" }));
}

module.exports = { create, findPendingByUser };
