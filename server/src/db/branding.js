const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("branding");
}

const DEFAULT_ID = "global";

async function get() {
  const doc = await collection().findOne({ id: DEFAULT_ID });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

async function upsert({ logoUrl, faviconUrl, logoBlobPathname, faviconBlobPathname, updatedBy }) {
  const now = new Date().toISOString();
  const update = {
    $set: {
      updatedAt: now,
      updatedBy: updatedBy || null,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(faviconUrl !== undefined ? { faviconUrl } : {}),
      ...(logoBlobPathname !== undefined ? { logoBlobPathname } : {}),
      ...(faviconBlobPathname !== undefined ? { faviconBlobPathname } : {}),
    },
    $setOnInsert: {
      id: DEFAULT_ID,
      createdAt: now,
    },
  };
  await collection().updateOne({ id: DEFAULT_ID }, update, { upsert: true });
  return get();
}

async function ensureIndexes() {
  await collection().createIndex({ id: 1 }, { unique: true });
}

module.exports = { get, upsert, ensureIndexes };
