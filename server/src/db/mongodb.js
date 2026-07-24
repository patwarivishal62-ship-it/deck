const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}

const client = new MongoClient(uri);

let db;

async function connectDB() {
  if (db) return db;

  await client.connect();

  // Replace "deck" with your database name if you chose something else.
  db = client.db("deck");

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