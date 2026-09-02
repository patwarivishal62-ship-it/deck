"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, Clock, Repeat, X, Smartphone, CheckCircle, Send } from "lucide-react";
import { api } from "@/lib/api";

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

export default function ReminderManager() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    message: "",
    scheduledAt: "",
    frequency: "once",
    type: "custom",
  });
  const [creating, setCreating] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [vapidConfigured, setVapidConfigured] = useState(false);
  const [testPushSending, setTestPushSending] = useState(false);
  const [testResult, setTestResult] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [remData, pushData] = await Promise.all([
        api.listReminders(true),
        api.listPushSubs().catch(() => ({ subscriptions: [], vapidConfigured: false })),
      ]);
      setReminders(remData.reminders || []);
      setVapidConfigured(pushData.vapidConfigured || false);
      // If we have subscriptions, push is enabled
      if (pushData.subscriptions && pushData.subscriptions.length > 0) {
        setPushEnabled(true);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        setPushEnabled(true);
      }
    }
  }, []);

  async function handleCreate() {
    if (!form.message.trim()) return;
    setCreating(true);
    try {
      let scheduledAt = form.scheduledAt;
      if (!scheduledAt) {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        scheduledAt = d.toISOString();
      } else {
        scheduledAt = new Date(scheduledAt).toISOString();
      }
      await api.createReminder({
        message: form.message.trim(),
        scheduledAt,
        frequency: form.frequency,
        type: form.type,
        link: "/dashboard",
      });
      setForm({ message: "", scheduledAt: "", frequency: "once", type: "custom" });
      setShowForm(false);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  }

  async function handleEnablePush() {
    if (!("Notification" in window)) {
      alert("Notifications not supported in this browser");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      alert("Service Worker not supported — needed for push");
      return;
    }
    if (!("PushManager" in window)) {
      alert("Push Manager not supported in this browser");
      return;
    }

    setPushLoading(true);
    setTestResult("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Permission denied. Please enable notifications in browser settings.");
        setPushLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Get VAPID public key from server for real push
      let vapidKey = null;
      try {
        const vapidData = await api.request ? null : await fetch("/api/reminders/push/vapid-key", { credentials: "include" }).then((r) => r.json());
        // Use api wrapper
        const vd = await api.listPushSubs().then(() => {}).catch(() => {});
        // Actually fetch via api
        const res = await fetch("/api/reminders/push/vapid-key", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          vapidKey = data.publicKey;
        }
      } catch (e) {
        console.warn("Could not get VAPID key, trying without:", e);
      }

      // Try to get existing subscription or create new one with VAPID key
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const subscribeOptions = {
          userVisibleOnly: true,
        };
        if (vapidKey) {
          subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidKey);
        }
        subscription = await reg.pushManager.subscribe(subscribeOptions);
      }

      // Save to server
      await api.pushSubscribe({
        endpoint: subscription.endpoint,
        keys: subscription.toJSON().keys,
        userAgent: navigator.userAgent,
      });

      setPushEnabled(true);
      setVapidConfigured(!!vapidKey);
      setTestResult("✅ Real push enabled! You will get notifications even when Deck is closed.");

      // Show local confirmation
      try {
        await reg.showNotification("Deck real push enabled! 🔔", {
          body: "Timely nudges will arrive on your mobile even when Deck is closed. Task progress, goal check-ins, and activation reminders.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "push-enabled",
        });
      } catch {}
    } catch (e) {
      console.error("Enable push failed:", e);
      alert(`Failed to enable push: ${e.message}. Try using Chrome/Edge on Android or desktop. iOS Safari needs Add to Home Screen first.`);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleTestPush() {
    setTestPushSending(true);
    setTestResult("");
    try {
      const res = await fetch("/api/reminders/push/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "🔔 Real push test — if you see this on your phone, it's working!" }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        setTestResult(`✅ Test push sent to ${data.sent} device(s)! Check your phone notification shade.`);
      } else if (!data.pushConfigured) {
        setTestResult("⚠️ Push not configured on server. Set VAPID keys in .env. Showing local notification only.");
        // Fallback local
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification("Test push (local fallback) 🔔", {
            body: "Real push not configured, but local notifications work. Set VAPID keys for true mobile push.",
            icon: "/icons/icon-192.png",
          });
        }
      } else {
        setTestResult("⚠️ No push subscriptions found. Enable push first.");
      }
    } catch (e) {
      setTestResult(`❌ Test failed: ${e.message}`);
    } finally {
      setTestPushSending(false);
    }
  }

  async function handleSeedDefaults() {
    try {
      await api.seedReminders();
      load();
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Bell size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text">Smart Reminders — Real Push</h3>
            <p className="text-xs text-text-soft">Timely nudges to keep you organized, even when app is closed</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CFF] text-white shadow hover:bg-[#6A4AF0]"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {/* Real Push Status */}
      <div className={`mt-4 rounded-xl border p-3 ${pushEnabled ? "border-good-line bg-good-tint" : "border-amber-500/20 bg-amber-500/5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${pushEnabled ? "bg-emerald-500 text-white" : "bg-amber-500/10 text-amber-500"}`}>
              {pushEnabled ? <CheckCircle size={14} /> : <Smartphone size={14} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text">
                  {pushEnabled ? "Real mobile push enabled" : "Enable real mobile push"}
                </span>
                {vapidConfigured && <span className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[10px] font-bold text-[#7C5CFF]">VAPID READY</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-soft">
                {pushEnabled
                  ? "You'll get timely nudges on your phone even when Deck is closed. Perfect for task progress and daily alignment."
                  : "Get real push notifications on your mobile even when Deck is closed. Uses Web Push (VAPID) — works on Android Chrome, desktop, and iOS PWA."}
              </p>
              {!vapidConfigured && !pushEnabled && (
                <p className="mt-1 text-[11px] text-amber-600">Server VAPID not configured — will use local notifications fallback. Set VAPID keys in .env for true push.</p>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            {!pushEnabled ? (
              <button
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="rounded-full bg-[#7C5CFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-[#6A4AF0] disabled:opacity-50"
              >
                {pushLoading ? "Enabling..." : "Enable Push"}
              </button>
            ) : (
              <button
                onClick={handleTestPush}
                disabled={testPushSending}
                className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-text hover:border-[#7C5CFF]/40 disabled:opacity-50 inline-flex items-center gap-1"
              >
                <Send size={12} />
                {testPushSending ? "Sending..." : "Test Push"}
              </button>
            )}
          </div>
        </div>
        {testResult && (
          <div className="mt-2.5 rounded-lg bg-card border border-line px-3 py-2 text-xs text-text">{testResult}</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleSeedDefaults}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-text-soft hover:text-text hover:border-[#7C5CFF]/30"
        >
          ✨ Seed activation nudges
        </button>
        <button
          onClick={() => {
            setForm({
              message: "📋 Update your task progress to keep team aligned",
              scheduledAt: "",
              frequency: "daily",
              type: "task_progress",
            });
            setShowForm(true);
          }}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-text-soft hover:text-text"
        >
          + Daily progress reminder
        </button>
        <button
          onClick={() => {
            setForm({
              message: "🚀 Review your goals and keep momentum!",
              scheduledAt: "",
              frequency: "weekdays",
              type: "goal_checkin",
            });
            setShowForm(true);
          }}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-text-soft hover:text-text"
        >
          + Weekday goal check-in
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-xl border border-line bg-paper-2 p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-faint">Message</label>
              <input
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="e.g., Update your task progress"
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-[#7C5CFF]/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-faint">When</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="w-full rounded-lg border border-line bg-card px-2 py-2 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-faint">Repeat</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="w-full rounded-lg border border-line bg-card px-2 py-2 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-faint">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-line bg-card px-2 py-2 text-xs text-text focus:border-[#7C5CFF]/50 focus:outline-none"
              >
                <option value="custom">Custom</option>
                <option value="task_progress">Task Progress</option>
                <option value="task_due">Task Due</option>
                <option value="goal_checkin">Goal Check-in</option>
                <option value="general_nudge">General Nudge</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !form.message.trim()}
              className="w-full rounded-xl bg-[#7C5CFF] py-2.5 text-sm font-semibold text-white shadow hover:bg-[#6A4AF0] disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create reminder (real push)"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="py-4 text-center text-xs text-text-faint">Loading reminders...</p>
        ) : reminders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-paper-2 px-4 py-6 text-center">
            <Bell size={20} className="mx-auto text-text-faint" />
            <p className="mt-2 text-sm font-medium text-text">No reminders yet</p>
            <p className="mt-1 text-xs text-text-faint">Create your first reminder to get timely real push on mobile</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {reminders.map((r) => (
              <div key={r.id} className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-paper-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text truncate">{r.message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-faint">
                    <span className="inline-flex items-center gap-1"><Clock size={10} />{new Date(r.scheduledAt).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1"><Repeat size={10} />{r.frequency}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.sent ? "bg-good-tint text-good-text" : "bg-amber-500/10 text-amber-500"}`}>
                      {r.sent ? "sent" : "pending"}
                    </span>
                    <span className="rounded-full bg-card border border-line px-2 py-0.5">{r.type}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-full bg-card text-text-faint hover:text-error-text hover:bg-error-tint transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
