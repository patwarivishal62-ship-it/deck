"use client";

import { useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import SettingsCard from "@/components/SettingsCard";
import Modal from "@/components/Modal";
import { Field, TextInput, TextArea, Button } from "@/components/FormControls";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile({ name });
      setMessage("Profile updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Profile" description="Your name is shown in the top bar.">
      <form onSubmit={handleSave}>
        <Field label="Full name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email">
          <TextInput value={user?.email || ""} disabled className="cursor-not-allowed opacity-70" />
        </Field>
        {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}
        {message && <p className="mb-3 text-sm text-good">{message}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </SettingsCard>
  );
}

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Security" description="Change your password.">
      <form onSubmit={handleSubmit}>
        <Field label="Current password">
          <TextInput
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="New password">
          <TextInput
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}
        {message && <p className="mb-3 text-sm text-good">{message}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Updating…" : "Change password"}
        </Button>
      </form>
    </SettingsCard>
  );
}

function AccountActionsSection() {
  const { logout } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      await api.requestAccountDeletion({ reason });
      setSubmitted(true);
      setConfirmOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsCard title="Account" danger>
      <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-paper px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text">Log out</p>
          <p className="text-xs text-text-soft">Sign out of Deck on this device.</p>
        </div>
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-signal-tint bg-signal-tint/40 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-signal-deep">Delete account</p>
          <p className="text-xs text-text-soft">
            Submits a request for your account and data to be permanently removed.
          </p>
        </div>
        {submitted ? (
          <span className="text-xs font-medium text-good">Request submitted</span>
        ) : (
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete account
          </Button>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete your account?">
        <p className="mb-3 text-sm text-text-soft">
          This action is irreversible. Your projects and account data may be permanently removed once
          reviewed. This submits a request — your account isn't deleted immediately.
        </p>
        <Field label="Reason for leaving (optional)">
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </Modal>
    </SettingsCard>
  );
}

function SettingsPageContent() {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-text">Settings</h1>
          <p className="text-sm text-text-soft">Manage your profile, security, and account.</p>
        </div>
        <div className="flex flex-col gap-5">
          <ProfileSection />
          <SecuritySection />
          <AccountActionsSection />
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageContent />
    </AuthGuard>
  );
}
