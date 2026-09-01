"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "./Modal";
import { api } from "@/lib/api";

export default function ProjectAccessModal({ open, onClose, projectId, projectName }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingUserId, setPendingUserId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProjectAccess(projectId);
      setMembers(data.members);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function handleToggle(member) {
    setPendingUserId(member.userId);
    try {
      await api.updateProjectAccess(projectId, member.userId, !member.hasAccess);
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, hasAccess: !m.hasAccess } : m))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Manage access — ${projectName}`}>
      <p className="mb-4 text-sm text-text-soft">
        Members only see this project if you give them access here. Admins and Owners always see every
        project, this list only affects Members.
      </p>

      {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-text-soft">No Members in this workspace yet — invite someone from Team.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <label
              key={m.userId}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{m.name || m.email}</p>
                {m.name && <p className="truncate text-xs text-text-faint">{m.email}</p>}
              </div>
              <input
                type="checkbox"
                checked={m.hasAccess}
                disabled={pendingUserId === m.userId}
                onChange={() => handleToggle(m)}
                className="h-4 w-4 shrink-0 accent-signal"
              />
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
