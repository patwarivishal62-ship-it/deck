// In-memory stand-in for the MongoDB collection API, used only when
// MONGODB_URI is not set (local dev / sandboxes with no database access).
//
// It implements exactly the query/update surface the db/*.js modules use —
// nothing more — so every route keeps working against a throwaway store.
// Data is lost on restart; mongodb.js warns loudly when this mode is active.

const OPERATORS = new Set(["$in", "$ne", "$exists", "$or", "$and", "$gt", "$lt", "$gte", "$lte"]);

function isOperatorObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof RegExp) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every((k) => OPERATORS.has(k))
  );
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (a instanceof RegExp || b instanceof RegExp) return a.toString() === b.toString();
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual(a[k], b[k]));
}

function matchValue(docValue, condition) {
  if (condition instanceof RegExp) {
    return typeof docValue === "string" && condition.test(docValue);
  }
  if (isOperatorObject(condition)) {
    return Object.entries(condition).every(([op, value]) => {
      switch (op) {
        case "$in": {
          // Mongo semantics: a scalar field matches if it equals any value;
          // an array field matches if ANY of its elements equals any value.
          const candidates = Array.isArray(docValue) ? docValue : [docValue];
          return Array.isArray(value) && value.some((v) => candidates.some((c) => deepEqual(v, c)));
        }
        case "$ne":
          return !deepEqual(docValue, value);
        case "$exists":
          return value ? docValue !== undefined : docValue === undefined;
        case "$gt":
          return docValue > value;
        case "$lt":
          return docValue < value;
        case "$gte":
          return docValue >= value;
        case "$lte":
          return docValue <= value;
        default:
          return false;
      }
    });
  }
  // Plain equality — but an array field matches if it *contains* the value,
  // mirroring Mongo's array behavior for e.g. { tags: "campaign" }.
  if (Array.isArray(docValue)) return docValue.some((v) => deepEqual(v, condition));
  return deepEqual(docValue, condition);
}

function matchDoc(doc, query) {
  return Object.entries(query || {}).every(([key, condition]) => {
    if (key === "$and") {
      return (condition || []).every((clause) => matchDoc(doc, clause));
    }
    if (key === "$or") {
      return (condition || []).some((clause) => matchDoc(doc, clause));
    }
    return matchValue(doc[key], condition);
  });
}

function applyUpdate(doc, update = {}, { onInsert = false } = {}) {
  if (onInsert && update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
  if (update.$set) Object.assign(doc, update.$set);
  if (update.$unset) {
    Object.keys(update.$unset).forEach((k) => delete doc[k]);
  }
  if (update.$push) {
    Object.entries(update.$push).forEach(([field, value]) => {
      if (!Array.isArray(doc[field])) doc[field] = [];
      doc[field].push(deepClone(value));
    });
  }
  if (update.$pull) {
    Object.entries(update.$pull).forEach(([field, condition]) => {
      if (Array.isArray(doc[field])) {
        doc[field] = doc[field].filter((item) => !matchDoc(item, condition));
      }
    });
  }
  if (update.$addToSet) {
    Object.entries(update.$addToSet).forEach(([field, value]) => {
      if (!Array.isArray(doc[field])) doc[field] = [];
      if (!doc[field].some((item) => deepEqual(item, value))) doc[field].push(deepClone(value));
    });
  }
}

function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

class Cursor {
  constructor(docs) {
    this.docs = docs;
    this.sortSpec = null;
    this.limitCount = null;
    this.projection = null;
  }

  sort(spec) {
    this.sortSpec = spec || {};
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  project(spec) {
    this.projection = spec || null;
    return this;
  }

  async toArray() {
    let docs = [...this.docs];
    if (this.sortSpec) {
      const keys = Object.keys(this.sortSpec);
      docs.sort((a, b) => {
        for (const key of keys) {
          const dir = this.sortSpec[key];
          const result = compareValues(a[key], b[key]);
          if (result !== 0) return result * dir;
        }
        return 0;
      });
    }
    if (this.limitCount !== null) docs = docs.slice(0, this.limitCount);
    return docs.map((doc) => this.shape(doc));
  }

  shape(doc) {
    if (!this.projection) return deepClone(doc);
    const projected = { _id: doc._id };
    Object.entries(this.projection).forEach(([key, include]) => {
      if (include) projected[key] = deepClone(doc[key]);
    });
    return projected;
  }
}

class Collection {
  constructor(name) {
    this.name = name;
    this.docs = [];
  }

  find(query = {}, options = {}) {
    const matches = this.docs.filter((doc) => matchDoc(doc, query));
    return new Cursor(matches).project(options && options.projection);
  }

  async findOne(query = {}) {
    const doc = this.docs.find((d) => matchDoc(d, query));
    return doc ? deepClone(doc) : null;
  }

  async insertOne(doc) {
    const stored = { _id: ++insertCounter, ...deepClone(doc) };
    this.docs.push(stored);
    return { insertedId: stored.id !== undefined ? stored.id : stored._id, acknowledged: true };
  }

  async updateOne(query = {}, update = {}, options = {}) {
    const doc = this.docs.find((d) => matchDoc(d, query));
    if (doc) {
      applyUpdate(doc, update);
      return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
    }
    if (options && options.upsert) {
      const base = {};
      Object.entries(query).forEach(([key, value]) => {
        if (!key.startsWith("$") && !isOperatorObject(value)) base[key] = deepClone(value);
      });
      const fresh = { _id: ++insertCounter, ...base };
      applyUpdate(fresh, update, { onInsert: true });
      this.docs.push(fresh);
      return { matchedCount: 0, modifiedCount: 0, upsertedId: fresh.id !== undefined ? fresh.id : fresh._id, acknowledged: true };
    }
    return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  }

  async updateMany(query = {}, update = {}) {
    let modifiedCount = 0;
    for (const doc of this.docs) {
      if (matchDoc(doc, query)) {
        applyUpdate(doc, update);
        modifiedCount += 1;
      }
    }
    return { matchedCount: modifiedCount, modifiedCount, acknowledged: true };
  }

  async deleteOne(query = {}) {
    const idx = this.docs.findIndex((d) => matchDoc(d, query));
    if (idx === -1) return { deletedCount: 0, acknowledged: true };
    this.docs.splice(idx, 1);
    return { deletedCount: 1, acknowledged: true };
  }

  async deleteMany(query = {}) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matchDoc(d, query));
    return { deletedCount: before - this.docs.length, acknowledged: true };
  }

  async countDocuments(query = {}) {
    return this.docs.filter((d) => matchDoc(d, query)).length;
  }

  async createIndex() {
    return "memory-index";
  }
}

// Shared by every collection so _id is monotonically increasing — sorting
// goals by _id (their only ordering column) then reproduces insertion order.
let insertCounter = 0;

function createMemoryDb() {
  const collections = new Map();
  return {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new Collection(name));
      return collections.get(name);
    },
    _isMemory: true,
  };
}

module.exports = { createMemoryDb };
