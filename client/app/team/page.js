"use client";

import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import SettingsCard from "@/components/SettingsCard";
import { Field, TextInput, Select, Button } from "@/components/FormControls";
import { api } from "@/lib/api";

const ROLE_LABELS = { owner: "Owner", admin: "Admin", member: "Member" };

function RoleBadge({ role }) {
  const colors = {
    owner: "bg-signal text-white",
    admin: "bg-signal-tint text-signal-deep",
    member: "bg-line text-text-soft",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${colors[role]}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function InviteForm({ workspaceId, onInvited }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.inviteMember(workspaceId, { email: email.trim(), role });
      setEmail("");
      setSent(true);
      onInvited();
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px] flex-1">
        <Field label="Invite by email">
          <TextInput
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
          />
        </Field>
      </div>
      <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-auto">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </Select>
      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send invite"}
      </Button>
      {error && <p className="w-full text-sm text-signal-deep">{error}</p>}
      {sent && <p className="w-full text-sm text-good">Invite sent.</p>}
    </form>
  );
}

function MembersList({ workspace, members, currentUserRole, onChanged }) {
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  async function handleRoleChange(membershipId, newRole) {
    try {
      await api.updateMemberRole(workspace.id, membershipId, newRole);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRemove(membershipId) {
    if (!confirm("Remove this person from the workspace?")) return;
    try {
      await api.removeMember(workspace.id, membershipId);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">
              {m.name || m.email}
              {m.status === "pending" && (
                <span className="ml-2 text-xs font-normal text-text-faint">(invite pending)</span>
              )}
            </p>
            {m.name && <p className="truncate text-xs text-text-faint">{m.email}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {currentUserRole === "owner" && m.role !== "owner" ? (
              <Select
                value={m.role}
                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                className="w-auto py-1 text-xs"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </Select>
            ) : (
              <RoleBadge role={m.role} />
            )}
            {canManage && m.role !== "owner" && (
              <button
                type="button"
                onClick={() => handleRemove(m.id)}
                className="text-xs text-text-faint hover:text-signal-deep"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateWorkspaceForm({ onCreated }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createWorkspace({ name: name.trim() });
      setName("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="min-w-[200px] flex-1">
        <Field label="New workspace name">
          <TextInput
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Marketing"
          />
        </Field>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create workspace"}
      </Button>
      {error && <p className="text-sm text-signal-deep">{error}</p>}
    </form>
  );
}

function TeamPageContent() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspaces = useCallback(async () => {
    const data = await api.listWorkspaces();
    setWorkspaces(data.workspaces);
    setActiveId((current) => current || data.workspaces[0]?.id || null);
    return data.workspaces;
  }, []);

  const loadMembers = useCallback(async (workspaceId) => {
    if (!workspaceId) return;
    const data = await api.listMembers(workspaceId);
    setMembers(data.members);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadWorkspaces();
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (activeId) loadMembers(activeId).catch((err) => setError(err.message));
  }, [activeId, loadMembers]);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  async function refreshAll() {
    await loadWorkspaces();
    if (activeId) await loadMembers(activeId);
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Team" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-text">Team</h1>
          <p className="text-sm text-text-soft">Manage the workspaces you belong to and who's in them.</p>
        </div>

        {error && <p className="mb-4 text-sm text-signal-deep">{error}</p>}

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {workspaces.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveId(w.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                      w.id === activeId
                        ? "border-signal bg-signal-tint text-signal-deep"
                        : "border-line bg-card text-text-soft hover:border-signal/40"
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            {activeWorkspace && (
              <SettingsCard
                title={activeWorkspace.name}
                description={
                  activeWorkspace.personal
                    ? "Your personal workspace."
                    : `You're a ${ROLE_LABELS[activeWorkspace.role].toLowerCase()} here.`
                }
              >
                <MembersList
                  workspace={activeWorkspace}
                  members={members}
                  currentUserRole={activeWorkspace.role}
                  onChanged={refreshAll}
                />

                {(activeWorkspace.role === "owner" || activeWorkspace.role === "admin") && (
                  <div className="mt-4 border-t border-line pt-4">
                    <InviteForm workspaceId={activeWorkspace.id} onInvited={refreshAll} />
                  </div>
                )}
              </SettingsCard>
            )}

            <SettingsCard
              title="Create a new workspace"
              description="Separate spaces for separate clients or teams — each with its own members and projects."
            >
              <CreateWorkspaceForm onCreated={refreshAll} />
            </SettingsCard>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TeamPage() {
  return (
    <AuthGuard>
      <TeamPageContent />
    </AuthGuard>
  );
}
