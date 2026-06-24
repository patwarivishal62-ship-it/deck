const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// node:sqlite is built into Node 22.5+ — no native compilation, no network
// download required. It's still flagged "experimental" by Node, but the API
// surface used here (prepare/run/get/all/exec) is stable across Node 22.x.
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "..", "dev.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    userId TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    platform TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL,
    targetValue REAL NOT NULL DEFAULT 0,
    currentValue REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT 'monthly',
    step REAL NOT NULL DEFAULT 1,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    goalId TEXT,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    dueDate TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    completedAt TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (goalId) REFERENCES goals(id) ON DELETE SET NULL
  );
`);

db.exec("CREATE INDEX IF NOT EXISTS idx_projects_userId ON projects(userId);");
db.exec("CREATE INDEX IF NOT EXISTS idx_goals_projectId ON goals(projectId);");
db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId);");
db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_goalId ON tasks(goalId);");

module.exports = db;
