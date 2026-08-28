// In-memory MongoDB-compatible shim for local preview/development.
//
// The real server code (server/src/**) talks to MongoDB through a tiny
// surface: collection().find/findOne/insertOne/updateOne/deleteOne/
// deleteMany/countDocuments with a handful of operators ($and, $or, $in,
// $ne, $exists, $set, $push, $pull, $addToSet, $unset). This module
// implements exactly that surface in plain JS, so the entire Express API can
// run locally with zero external services. Data lives in memory only — it
// resets on restart.
//
// NOT for production use.

function isRegExp(v) {
  return v instanceof RegExp;
}

// Does a single value match a Mongo-style condition?
function matchValue(value, cond) {
  if (cond && typeof cond === "object" && !isRegExp(cond) && !Array.isArray(cond)) {
    for (const [op, operand] of Object.entries(cond)) {
      switch (op) {
        case "$in":
          if (!operand.includes(value)) return false;
          break;
        case "$ne":
          if (value === operand) return false;
          break;
        case "$nin":
          if (operand.includes(value)) return false;
          break;
        case "$exists":
          if (operand && value === undefined) return false;
          if (!operand && value !== undefined) return false;
          break;
        case "$gt":
          if (!(value > operand)) return false;
          break;
        case "$gte":
          if (!(value >= operand)) return false;
          break;
        case "$lt":
          if (!(value < operand)) return false;
          break;
        case "$lte":
          if (!(value <= operand)) return false;
          break;
        default:
          return false;
      }
    }
    return true;
  }
  if (isRegExp(cond)) return cond.test(value ?? "");
  return value === cond;
}

function matches(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;
  for (const [key, cond] of Object.entries(query)) {
    if (key === "$and") {
      if (!cond.every((q) => matches(doc, q))) return false;
      continue;
    }
    if (key === "$or") {
      if (!cond.some((q) => matches(doc, q))) return false;
      continue;
    }
    if (key === "$nor") {
      if (cond.some((q) => matches(doc, q))) return false;
      continue;
    }
    if (!matchValue(doc[key], cond)) return false;
  }
  return true;
}

function compare(a, b) {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

class Cursor {
  constructor(docs) {
    this.docs = docs;
    this._sort = null;
    this._limit = Infinity;
  }
  sort(spec) {
    this._sort = spec;
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  toArray() {
    let out = [...this.docs];
    if (this._sort) {
      const fields = Object.entries(this._sort);
      out.sort((x, y) => {
        for (const [f, dir] of fields) {
          const r = compare(x[f], y[f]);
          if (r !== 0) return r * dir;
        }
        return 0;
      });
    }
    return out.slice(0, this._limit).map((d) => ({ ...d }));
  }
}

class Collection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
    if (!store[name]) store[name] = [];
  }
  get docs() {
    return this.store[this.name];
  }
  async createIndex() {
    return this.name;
  }
  find(query, options) {
    let docs = this.docs.filter((d) => matches(d, query));
    // Minimal projection support: { field: 1 } keeps only listed fields
    // (plus _id). The server uses this once, for id-only lookups.
    if (options && options.projection) {
      const include = Object.entries(options.projection).filter(([, v]) => v).map(([k]) => k);
      if (include.length > 0) {
        docs = docs.map((d) => {
          const out = { _id: d._id };
          include.forEach((k) => {
            if (d[k] !== undefined) out[k] = d[k];
          });
          return out;
        });
      }
    }
    return new Cursor(docs);
  }
  async findOne(query) {
    const doc = this.docs.find((d) => matches(d, query));
    return doc ? { ...doc } : null;
  }
  async insertOne(doc) {
    const withId = { ...doc, _id: `${this.name}:${this.docs.length + 1}` };
    this.docs.push(withId);
    return { acknowledged: true, insertedId: withId._id };
  }
  async updateOne(query, update) {
    const doc = this.docs.find((d) => matches(d, query));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(doc, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async updateMany(query, update) {
    let modified = 0;
    this.docs.filter((d) => matches(d, query)).forEach((d) => {
      applyUpdate(d, update);
      modified += 1;
    });
    return { matchedCount: modified, modifiedCount: modified };
  }
  async deleteOne(query) {
    const i = this.docs.findIndex((d) => matches(d, query));
    if (i === -1) return { deletedCount: 0 };
    this.docs.splice(i, 1);
    return { deletedCount: 1 };
  }
  async deleteMany(query) {
    const before = this.docs.length;
    this.store[this.name] = this.docs.filter((d) => !matches(d, query));
    return { deletedCount: before - this.store[this.name].length };
  }
  async countDocuments(query) {
    return this.docs.filter((d) => matches(d, query)).length;
  }
}

function applyUpdate(doc, update) {
  for (const [op, fields] of Object.entries(update)) {
    switch (op) {
      case "$set":
        Object.entries(fields).forEach(([k, v]) => {
          doc[k] = v;
        });
        break;
      case "$unset":
        Object.entries(fields).forEach(([k]) => {
          delete doc[k];
        });
        break;
      case "$inc":
        Object.entries(fields).forEach(([k, v]) => {
          doc[k] = (doc[k] || 0) + v;
        });
        break;
      case "$push":
        Object.entries(fields).forEach(([k, v]) => {
          if (!Array.isArray(doc[k])) doc[k] = [];
          doc[k].push(v);
        });
        break;
      case "$pull":
        Object.entries(fields).forEach(([k, cond]) => {
          if (!Array.isArray(doc[k])) return;
          doc[k] = doc[k].filter((item) => !matches(item, cond));
        });
        break;
      case "$addToSet":
        Object.entries(fields).forEach(([k, v]) => {
          if (!Array.isArray(doc[k])) doc[k] = [];
          const exists = doc[k].some((item) => matchValue(item, v));
          if (!exists) doc[k].push(v);
        });
        break;
      default:
        // Plain field replacement (updateOne with bare fields)
        doc[op] = fields;
    }
  }
}

class MemoryDb {
  constructor() {
    this.store = {};
  }
  collection(name) {
    return new Collection(this.store, name);
  }
}

const db = new MemoryDb();

module.exports = {
  // Same surface as server/src/db/mongodb.js
  connectDB: async () => db,
  getDb: () => {
    if (!db) throw new Error("connectDB not called");
    return db;
  },
  __store: db.store,
};
