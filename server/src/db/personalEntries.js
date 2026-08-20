const { nanoid } = require("nanoid");
const { getDb } = require("./mongodb");

// Personal notes & to-dos. These are strictly private: every query is scoped
// by userId, so no other user (or workspace collaborator) can ever see them.
// Unlike projects/goals/tasks, they have no workspace or project association —
// they belong to the person, and their `date` is the calendar day they're
// attached to (which is how the calendar turns into a day-by-day record of
// what the user logged and completed).
function collection() {
  return getDb().collection("entries");
}

function toEntry(doc) {
  if (!doc) return null;
  const { _id, ...entry } = doc;
  return entry;
}

// kind: "note" (free-form) | "todo" (has a done state + optional dueDate)
async function listForUser(userId) {
  const docs = await collection()
    .find({ userId })
    .sort({ date: 1, createdAt: 1 })
    .toArray();
  return docs.map(toEntry);
}

async function findById(id, userId) {
  return toEntry(await collection().findOne({ id, userId }));
}

async function create({ userId, kind, text, date, dueDate }) {
  const entry = {
    id: nanoid(),
    userId,
    kind,
    text,
    date,
    dueDate: dueDate || null,
    done: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await collection().insertOne(entry);
  return toEntry(entry);
}

async function update(id, userId, fields) {
  const allowed = ["kind", "text", "date", "dueDate", "done"];
  const setDoc = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) setDoc[k] = fields[k];
  }

  // Marking done records when it happened; un-marking clears it — this is the
  // "proof of what was completed and when" signal the calendar surfaces.
  if (setDoc.done !== undefined) {
    setDoc.completedAt = setDoc.done ? new Date().toISOString() : null;
  }

  if (Object.keys(setDoc).length > 0) {
    setDoc.updatedAt = new Date().toISOString();
    await collection().updateOne({ id, userId }, { $set: setDoc });
  }
  return toEntry(await collection().findOne({ id, userId }));
}

async function remove(id, userId) {
  await collection().deleteOne({ id, userId });
}

module.exports = { listForUser, findById, create, update, remove };
