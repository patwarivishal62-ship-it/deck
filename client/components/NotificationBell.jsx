"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { usePWA } from "@/lib/PWAContext";

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

function getTypeIcon(type) {
  switch (type) {
    case "task_assigned":
      return "👤";
    case "task_completed":
      return "✅";
    case "deadline_approaching":
      return "⏰";
    case "general_nudge":
      return "💡";
    case "task_progress":
      return "📋";
    case "goal_checkin":
      return "🎯";
    case "voice_processed":
      return "🎤";
    case "comment":
    case "mention":
      return "💬";
    default:
      return "🔔";
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const { showLocalNotification, notificationPermission } = usePWA();
  const prevUnreadRef = useRef(0);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listNotifications();
      const newNotifications = data.notifications || [];
      const newUnread = data.unreadCount || 0;

      // If we have new unread notifications and permission granted, show a local push
      if (
        newUnread > prevUnreadRef.current &&
        notificationPermission === "granted" &&
        prevUnreadRef.current !== 0 // don't notify on first load
      ) {
        const newest = newNotifications.find((n) => !n.read);
        if (newest) {
          try {
            await showLocalNotification(newest.message?.slice(0, 60) || "New notification from Deck", {
              body: newest.message || "Tap to open Deck",
              url: newest.link || "/dashboard",
              tag: `deck-${newest.id}`,
            });
          } catch {}
        }
      }

      prevUnreadRef.current = newUnread;
      setNotifications(newNotifications);
      setUnreadCount(newUnread);
    } catch {
      // Quiet failure — the bell just stays at whatever it last showed.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Check every 30s for timely reminders

    // Listen for custom event from SW to re-check
    function onCheck() {
      load();
    }
    window.addEventListener("deck:check-reminders", onCheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener("deck:check-reminders", onCheck);
    };
  }, [notificationPermission]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) await load();
  }

  async function handleItemClick(n) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.markNotificationRead(n.id);
      } catch {}
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-text/80 transition hover:border-[#7C5CFF]/40 hover:text-text hover:bg-card"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7C5CFF] px-1 font-mono text-[9px] font-bold text-white shadow-[0_2px_8px_rgba(124,92,255,0.5)] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[min(32rem,75dvh)] overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_40px_-12px_rgba(16,24,40,0.25)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[10px] font-medium text-[#7C5CFF]">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-[#7C5CFF] hover:text-[#8B6DFF]">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <span className="text-2xl">✨</span>
                <p className="mt-2 text-sm font-medium text-text">You&apos;re all caught up!</p>
                <p className="mt-1 text-xs text-text-soft">We&apos;ll nudge you when tasks need attention or your team needs you.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/projects"}
                  onClick={() => handleItemClick(n)}
                  className={`flex gap-3 border-b border-line px-4 py-3 text-sm transition last:border-b-0 hover:bg-paper-2 ${n.read ? "text-text-soft" : "text-text bg-signal-tint/50"}`}
                >
                  <span className="mt-0.5 text-base leading-none">{getTypeIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`${n.read ? "" : "font-medium"} leading-snug`}>{n.message}</span>
                      {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C5CFF]" />}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-text-faint">{timeAgo(n.createdAt)}</span>
                      {n.synthetic && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">reminder</span>}
                      {n.type && <span className="rounded-full bg-card border border-line px-1.5 py-0.5 text-[10px] text-text-faint">{n.type}</span>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-line bg-paper-2 px-4 py-2.5">
            <p className="text-[11px] leading-relaxed text-text-faint">
              💡 Enable mobile notifications to get timely nudges even when Deck is closed. Great for task progress updates!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
