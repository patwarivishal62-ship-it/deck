"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Quiet failure — the bell just stays at whatever it last showed.
    } finally {
      setLoading(false);
    }
  }

  // Poll lightly so the unread badge stays roughly current without needing
  // a websocket/push setup — this is an in-app center, not a push system.
  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

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
      } catch {
        // Non-critical — worst case it just shows unread again next load.
      }
    }
    setOpen(false);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      // Non-critical.
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-ink-line text-white/80 transition hover:border-signal hover:text-white"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal px-1 font-mono text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 overflow-hidden rounded-lg border border-line bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="text-sm font-medium text-text">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-text-faint hover:text-signal-deep"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center font-mono text-xs uppercase tracking-wide text-text-faint">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-soft">You're all caught up.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/projects"}
                  onClick={() => handleItemClick(n)}
                  className={`block border-b border-line px-3.5 py-2.5 text-sm transition last:border-b-0 hover:bg-paper ${
                    n.read ? "text-text-soft" : "text-text"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={n.read ? "" : "font-medium"}>{n.message}</span>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                  </div>
                  <span className="mt-0.5 block font-mono text-[11px] text-text-faint">
                    {timeAgo(n.createdAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
