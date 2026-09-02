"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Smartphone, Send, CheckCircle } from "lucide-react";
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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Reminders and nudges are created by voice and delivered by the server on a
// schedule — there is intentionally no manual reminders list on the dashboard.
// The only thing a person has to do here is grant the browser permission once,
// so that push can reach their phone even when Deck is closed.
function NotificationsSection() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      setPushEnabled(true);
    }
    api
      .listPushSubs()
      .then((d) => {
        setVapidConfigured(Boolean(d.vapidConfigured));
        if (d.subscriptions?.length) setPushEnabled(true);
      })
      .catch(() => {});
  }, []);

  async function handleEnable() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setTestResult("This browser can't receive push. Use Chrome/Edge on Android or desktop.");
      return;
    }
    setPushLoading(true);
    setTestResult("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setTestResult("Permission denied — enable notifications in your browser settings.");
        setPushLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let vapidKey = null;
      try {
        const res = await fetch("/api/reminders/push/vapid-key", { credentials: "include" });
        if (res.ok) vapidKey = (await res.json()).publicKey;
      } catch {}

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const options = { userVisibleOnly: true };
        if (vapidKey) options.applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await reg.pushManager.subscribe(options);
      }
      await api.pushSubscribe({
        endpoint: subscription.endpoint,
        keys: subscription.toJSON().keys,
        userAgent: navigator.userAgent,
      });
      setPushEnabled(true);
      setVapidConfigured(Boolean(vapidKey));
      setTestResult("Push enabled — reminders will reach this device even when Deck is closed.");
    } catch (e) {
      setTestResult(`Couldn't enable push: ${e.message}`);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTest() {
    setTestSending(true);
    setTestResult("");
    try {
      const res = await fetch("/api/reminders/push/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "🔔 Deck push test — if you see this, it's working!" }),
      });
      const data = await res.json();
      if (data.sent > 0) setTestResult(`Sent to ${data.sent} device(s). Check your notification shade.`);
      else if (!data.pushConfigured) setTestResult("Server VAPID keys aren't set, so only in-app alerts will fire. Add them in .env for true mobile push.");
      else setTestResult("No subscriptions yet — enable push first.");
    } catch (e) {
      setTestResult(`Test failed: ${e.message}`);
    } finally {
      setTestSending(false);
    }
  }

  return (
    <SettingsCard
      title="Notifications & mobile push"
      description="Voice reminders and nudges are pushed by the server on a schedule. Grant permission once to receive them on this device even when Deck is closed."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${pushEnabled ? "bg-good-tint text-good" : "bg-signal-tint text-signal"}`}>
            {pushEnabled ? <CheckCircle size={16} /> : <Smartphone size={16} />}
          </span>
          <div>
            <p className="text-sm font-medium text-text">{pushEnabled ? "Push is on for this device" : "Push is off"}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-soft">
              {pushEnabled
                ? "You'll get task, goal and reminder nudges on this device automatically."
                : "Works on Android Chrome, desktop, and iOS PWA. The server does the scheduling — no setup needed after this."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {!pushEnabled ? (
            <Button onClick={handleEnable} disabled={pushLoading}>
              {pushLoading ? "Enabling…" : "Enable push"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleTest} disabled={testSending}>
              <Send size={14} /> {testSending ? "Sending…" : "Test"}
            </Button>
          )}
        </div>
      </div>
      {testResult && <p className="mt-3 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-text-soft">{testResult}</p>}
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
        , including a direct{" "}
        <a href="/downloads/deck.apk" download="DECK.apk" className="underline underline-offset-2 hover:text-text">
          Android APK download
        </a>
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
          <NotificationsSection />
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
