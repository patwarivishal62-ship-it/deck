"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_ICON = {
  pdf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  video: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="M22 8.5v7l-5-3.5 5-3.5Z" />
    </svg>
  ),
  presentation: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="13" rx="1.5" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  ),
  document: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  ),
  other: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M13 2v7h7" />
    </svg>
  ),
};

function FileCard({ file, onDelete, canDelete }) {
  return (
    <div className="group relative rounded-card border border-line bg-card p-3">
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
        {file.category === "image" ? (
          <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-paper">
            <img src={file.url} alt={file.filename} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="mb-2 flex aspect-video items-center justify-center rounded-lg bg-paper text-text-faint">
            {CATEGORY_ICON[file.category] || CATEGORY_ICON.other}
          </div>
        )}
        <p className="truncate text-sm font-medium text-text">{file.filename}</p>
        <p className="mt-0.5 font-mono text-[11px] text-text-faint">
          {formatSize(file.size)} · {timeAgo(file.createdAt)}
        </p>
      </a>
      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(file)}
          aria-label="Delete file"
          className="absolute right-2 top-2 rounded-md bg-card/90 p-1.5 text-text-faint opacity-100 backdrop-blur transition hover:bg-signal-tint hover:text-signal-deep sm:opacity-0 sm:group-hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function FileManager({ projectId, canManage }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .listFiles(projectId)
      .then((data) => setFiles(data.files))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleFiles(fileList) {
    const [file] = fileList;
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = await api.uploadFile(projectId, file);
      setFiles((prev) => [data.file, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(file) {
    if (!confirm(`Delete "${file.filename}"?`)) return;
    try {
      await api.deleteFile(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mb-4 cursor-pointer rounded-card border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver ? "border-signal bg-signal-tint/40" : "border-line hover:border-signal/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm text-text-soft">
          {uploading ? "Uploading…" : <><span className="sm:hidden">Tap to upload a file</span><span className="hidden sm:inline">Drag and drop a file here, or click to browse</span></>}
        </p>
        <p className="mt-1 text-xs text-text-faint">Documents, images, PDFs, presentations, videos · up to 20 MB</p>
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-text-soft">No files yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDelete={handleDelete}
              canDelete={canManage || file.uploadedBy === user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
