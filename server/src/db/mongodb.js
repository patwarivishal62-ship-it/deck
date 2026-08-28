const { MongoClient } = require("mongodb");
const { createMemoryDb } = require("./memory");

let client;
let db;

async function connectDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // Dev/preview fallback: no database available, so run against a
    // throwaway in-memory store with the same collection API. Everything
    // works (signup, projects, goals, tasks, ...) but nothing persists.
    console.warn("⚠️  MONGODB_URI is not set — using the in-memory database.");
    console.warn("⚠️  Data will be lost when the server restarts. Set MONGODB_URI to use MongoDB.");
    db = createMemoryDb();
    return db;
  }

  client = new MongoClient(uri);
  await client.connect();

  // Replace "deck" with your database name if you chose something else.
  db = client.db("deck");

  // Mirrors the constraints/indexes that used to live in the SQLite schema
  // (UNIQUE email, FK lookup columns) so lookups stay fast and emails stay unique.
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ resetTokenHash: 1 }, { sparse: true });
  await db.collection("projects").createIndex({ id: 1 }, { unique: true });
  await db.collection("projects").createIndex({ workspaceId: 1 });
  await db.collection("projects").createIndex({ workspaceId: 1, archived: 1 });
  await db.collection("projects").createIndex({ workspaceId: 1, tags: 1 });
  await db.collection("projects").createIndex({ userId: 1 }); // legacy pre-workspace lookups during migration
  await db.collection("goals").createIndex({ id: 1 }, { unique: true });
  await db.collection("goals").createIndex({ projectId: 1 });
  await db.collection("tasks").createIndex({ id: 1 }, { unique: true });
  await db.collection("tasks").createIndex({ projectId: 1 });
  await db.collection("tasks").createIndex({ goalId: 1 });
  await db.collection("deletionRequests").createIndex({ id: 1 }, { unique: true });
  await db.collection("deletionRequests").createIndex({ userId: 1 });
  await db.collection("workspaces").createIndex({ id: 1 }, { unique: true });
  await db.collection("workspaces").createIndex({ ownerId: 1, personal: 1 });
  await db.collection("memberships").createIndex({ id: 1 }, { unique: true });
  await db.collection("memberships").createIndex({ workspaceId: 1, userId: 1 });
  await db.collection("memberships").createIndex({ userId: 1, status: 1 });
  await db.collection("memberships").createIndex({ inviteTokenHash: 1 }, { sparse: true });
  await db.collection("memberships").createIndex({ workspaceId: 1, email: 1 });
  await db.collection("comments").createIndex({ id: 1 }, { unique: true });
  await db.collection("comments").createIndex({ projectId: 1, taskId: 1 });
  await db.collection("activityLog").createIndex({ id: 1 }, { unique: true });
  await db.collection("activityLog").createIndex({ projectId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ id: 1 }, { unique: true });
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ userId: 1, read: 1 });
  await db.collection("files").createIndex({ id: 1 }, { unique: true });
  await db.collection("files").createIndex({ projectId: 1, createdAt: -1 });
  await db.collection("milestones").createIndex({ id: 1 }, { unique: true });
  await db.collection("milestones").createIndex({ projectId: 1, date: 1 });
  await db.collection("metrics").createIndex({ id: 1 }, { unique: true });
  await db.collection("metrics").createIndex({ projectId: 1 });
  await db.collection("branding").createIndex({ id: 1 }, { unique: true });
  await db.collection("entries").createIndex({ id: 1 }, { unique: true });
  await db.collection("entries").createIndex({ userId: 1, date: 1 });

  console.log("✅ Connected to MongoDB");

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }

  return db;
}

module.exports = {
  connectDB,
  getDb,
};
