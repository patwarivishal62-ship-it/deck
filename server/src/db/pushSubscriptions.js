const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("pushSubscriptions");
}

function toSub(doc) {
  if (!doc) return null;
  const { _id, ...sub } = doc;
  return sub;
}

async function upsert({ userId, endpoint, keys, userAgent }) {
  const existing = await collection().findOne({ userId, endpoint });
  if (existing) {
    await collection().updateOne(
      { id: existing.id },
      { $set: { keys, userAgent, updatedAt: new Date().toISOString() } }
    );
    return toSub(await collection().findOne({ id: existing.id }));
  }
  const sub = {
    id: nanoid(),
    userId,
    endpoint,
    keys,
    userAgent: userAgent || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await collection().insertOne(sub);
  return toSub(sub);
}

async function listForUser(userId) {
  const docs = await collection().find({ userId }).toArray();
  return docs.map(toSub);
}

async function listAll() {
  const docs = await collection().find({}).toArray();
  return docs.map(toSub);
}

async function removeByEndpoint(userId, endpoint) {
  await collection().deleteOne({ userId, endpoint });
}

async function removeByUser(userId) {
  await collection().deleteMany({ userId });
}

module.exports = {
  upsert,
  listForUser,
  listAll,
  removeByEndpoint,
  removeByUser,
};
