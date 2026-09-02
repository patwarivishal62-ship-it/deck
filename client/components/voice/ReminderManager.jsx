"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, Trash2, Clock, Calendar, Repeat, X, Check } from "lucide-react";
import { api } from "@/lib/api";

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

  async function load() {
    setLoading(true);
    try {
      const data = await api.listReminders(true);
      setReminders(data.reminders || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Check push permission
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
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
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushEnabled(permission === "granted");

      if (permission === "granted" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        // Try to subscribe to push if VAPID key available (optional)
        // For now just show a local notification as proof
        reg.showNotification("Deck reminders enabled! 🔔", {
          body: "You'll get timely nudges to stay organized and aligned.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
        });

        // Save a push subscription placeholder (real push needs VAPID)
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await api.pushSubscribe({
              endpoint: sub.endpoint,
              keys: sub.toJSON().keys,
            });
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPushLoading(false);
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
            <h3 className="text-sm font-semibold text-text">Smart Reminders</h3>
            <p className="text-xs text-text-soft">Timely nudges to keep you organized</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C5CFF] text-white shadow hover:bg-[#6A4AF0]"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {/* Push enable */}
      <div className="mt-4 rounded-xl border border-line bg-paper-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${pushEnabled ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="text-sm font-medium text-text">
              {pushEnabled ? "Mobile notifications enabled" : "Enable mobile notifications"}
            </span>
          </div>
          {!pushEnabled && (
            <button
              onClick={handleEnablePush}
              disabled={pushLoading}
              className="rounded-full bg-card border border-line px-3 py-1 text-xs font-semibold text-text hover:border-[#7C5CFF]/40 disabled:opacity-50"
            >
              {pushLoading ? "Enabling..." : "Enable"}
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-text-faint">
          Get reminders on your phone even when Deck is closed. Perfect for task progress updates and daily alignment.
        </p>
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
              {creating ? "Creating..." : "Create reminder"}
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
            <p className="mt-1 text-xs text-text-faint">Create your first reminder to get timely nudges on mobile</p>
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
