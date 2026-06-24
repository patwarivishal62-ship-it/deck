// Database layer built on Node's built-in `node:sqlite` (stable enough for
// local dev, ships with Node — no native compile step, no Prisma binary
// download needed). Swapping to Postgres later just means rewriting this
// one file; every route calls the functions below, never raw SQL.

const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "../../dev.db");
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'other',
    platform TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL,
    targetValue REAL NOT NULL DEFAULT 0,
    currentValue REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT 'monthly',
    step REAL NOT NULL DEFAULT 1,
    projectId TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    dueDate TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    completedAt TEXT,
    projectId TEXT NOT NULL,
    goalId TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (goalId) REFERENCES goals(id) ON DELETE SET NULL
  );
`);

module.exports = db;
