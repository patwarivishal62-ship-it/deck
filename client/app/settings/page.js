"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import SettingsCard from "@/components/SettingsCard";
import Modal from "@/components/Modal";
import InstallButton from "@/components/InstallButton";
import { InstallSteps } from "@/components/InstallSteps";
import { Field, TextInput, TextArea, Button } from "@/components/FormControls";
import { useAuth } from "@/lib/AuthContext";
import { usePWA } from "@/lib/PWAContext";
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
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
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
  const router = useRouter();
  const { logout, clearSession } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canConfirm = confirmText.trim().toLowerCase() === "delete";

  async function handleSubmit() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError("");
    try {
      await api.deleteAccount({ reason });
      clearSession();
      router.replace("/login");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <SettingsCard title="Account" danger>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text">Log out</p>
          <p className="text-xs text-text-soft">Sign out of Deck on this device.</p>
        </div>
        <Button variant="ghost" onClick={logout} className="w-full sm:w-auto">
          Log out
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-signal-tint bg-signal-tint/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-signal-deep">Delete account</p>
          <p className="text-xs text-text-soft">
            Permanently deletes your account and all of its projects, goals, and tasks — right away.
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirmOpen(true)} className="w-full sm:w-auto">
          Delete account
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmText("");
        }}
        title="Delete your account?"
      >
        <p className="mb-3 text-sm text-signal-deep">
          This deletes your account and every project, goal, and task in it immediately. This cannot be
          undone.
        </p>
        <Field label="Reason for leaving (optional)">
          <TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label={`Type "delete" to confirm`}>
          <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
        </Field>
        {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmOpen(false);
              setConfirmText("");
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={submitting || !canConfirm}>
            {submitting ? "Deleting…" : "Permanently delete"}
          </Button>
        </div>
      </Modal>
    </SettingsCard>
  );
}

function AppSection() {
  const { installed, platform, canInstall } = usePWA();

  return (
    <SettingsCard
      title="Get DECK on your devices"
      description="Install DECK as an app on desktop and mobile — full-screen, offline-ready, one tap away."
    >
      {installed ? (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-good-tint px-3 py-1.5 text-sm font-medium text-good">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          DECK is installed on this device
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-sm text-sm text-text-soft">
            {canInstall
              ? "Your browser supports one-tap install — grab it now, or see manual steps below."
              : "Add DECK to your home screen or dock:"}
          </p>
          <InstallButton variant="secondary" label="Install DECK" className="shrink-0" />
        </div>
      )}
      {!installed && !canInstall && (
        <details className="rounded-xl border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-text">
            How to install on this device
          </summary>
          <div className="mt-4">
            <InstallSteps platform={platform === "android" ? "android" : platform === "ios" ? "ios" : "desktop"} />
          </div>
        </details>
      )}
      <p className="mt-4 text-xs text-text-faint">
        Works on every device you use —{" "}
        <Link href="/download" className="underline underline-offset-2 hover:text-text">
          see all platforms
        </Link>
        .
      </p>
    </SettingsCard>
  );
}

function SettingsPageContent() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <PageHeading title="Settings" subtitle="Manage your profile, security, devices, and account." />
        <div className="mt-5 flex flex-col gap-5">
          <ProfileSection />
          <SecuritySection />
          <AppSection />
          <AccountActionsSection />
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageContent />
    </AuthGuard>
  );
}
