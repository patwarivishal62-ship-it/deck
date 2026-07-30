const { nanoid } = require("nanoid");
const { del } = require("@vercel/blob");
const { getDb } = require("./mongodb");

function collection() {
  return getDb().collection("files");
}

function toFile(doc) {
  if (!doc) return null;
  const { _id, ...file } = doc;
  return file;
}

// Coarse category used for grouping/icons in the UI — not exhaustive, just
// the categories the brief asked for (Documents, Images, PDFs,
// Presentations, Videos), with a catch-all "other" for anything else.
function categoryFor(contentType) {
  if (!contentType) return "other";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "application/pdf") return "pdf";
  if (
    contentType.includes("presentation") ||
    contentType === "application/vnd.ms-powerpoint"
  ) {
    return "presentation";
  }
  if (
    contentType.startsWith("text/") ||
    contentType.includes("document") ||
    contentType.includes("word") ||
    contentType.includes("spreadsheet") ||
    contentType.includes("excel")
  ) {
    return "document";
  }
  return "other";
}

async function listByProject(projectId) {
  const docs = await collection().find({ projectId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toFile);
}

async function findById(id) {
  return toFile(await collection().findOne({ id }));
}

async function create({ workspaceId, projectId, uploadedBy, filename, url, blobPathname, contentType, size }) {
  const file = {
    id: nanoid(),
    workspaceId,
    projectId,
    uploadedBy,
    filename,
    url,
    blobPathname,
    contentType,
    category: categoryFor(contentType),
    size,
    createdAt: new Date().toISOString(),
  };
  await collection().insertOne(file);
  return toFile(file);
}

async function remove(id) {
  const file = await findById(id);
  if (!file) return;
  await collection().deleteOne({ id });
  try {
    await del(file.url);
  } catch (err) {
    // The metadata record is already gone, which is what the user sees —
    // an orphaned blob costs a few cents of storage, not correctness, so
    // this is logged rather than surfaced as a failure.
    console.error("Failed to delete blob for removed file:", err);
  }
}

async function removeByProject(projectId) {
  const files = await listByProject(projectId);
  await Promise.all(
    files.map((f) =>
      del(f.url).catch((err) => console.error("Failed to delete blob during project cleanup:", err))
    )
  );
  await collection().deleteMany({ projectId });
}

module.exports = { listByProject, findById, create, remove, removeByProject, categoryFor };
