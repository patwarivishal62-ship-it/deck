const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("comments");
}

function toComment(doc) {
  if (!doc) return null;
  const { _id, ...comment } = doc;
  return comment;
}

// Mentions are stored as explicit tokens the client inserts when someone
// picks a name from the @-suggestion dropdown: @[Display Name](userId).
// This is deliberately NOT "guess the mention from plain text" — matching
// on raw @Name text breaks the moment a name has a space in it, and it
// would let anyone "mention" a string that isn't actually a real user.
// Parsing a structured token is unambiguous and lets us cheaply validate
// that every mention actually resolves to someone with access to this
// project (see validUserIds below).
const MENTION_TOKEN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

function extractMentions(body, validUserIds) {
  const validSet = new Set(validUserIds);
  const found = new Set();
  let match;
  MENTION_TOKEN.lastIndex = 0;
  while ((match = MENTION_TOKEN.exec(body))) {
    const userId = match[2];
    if (validSet.has(userId)) found.add(userId);
  }
  return Array.from(found);
}

// taskId: null for a project-level comment, a task id for a task-level one.
async function listForProject(projectId, taskId = null) {
  const docs = await collection()
    .find({ projectId, taskId: taskId || null })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map(toComment);
}

async function findById(id) {
  return toComment(await collection().findOne({ id }));
}

async function create({ workspaceId, projectId, taskId, authorId, body, validUserIds }) {
  const comment = {
    id: nanoid(),
    workspaceId,
    projectId,
    taskId: taskId || null,
    authorId,
    body,
    mentions: extractMentions(body, validUserIds),
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(comment);
  return toComment(comment);
}

async function remove(id) {
  await collection().deleteOne({ id });
}

async function removeByProject(projectId) {
  await collection().deleteMany({ projectId });
}

module.exports = { listForProject, findById, create, remove, removeByProject, extractMentions };
