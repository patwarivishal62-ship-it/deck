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
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7C5CFF] px-1 font-mono text-[9px] font-bold text-white shadow-[0_2px_8px_rgba(124,92,255,0.5)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[min(28rem,70dvh)] overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_40px_-12px_rgba(16,24,40,0.25)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-80">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-text">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-[#7C5CFF] hover:text-[#8B6DFF]">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-text-soft">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/projects"}
                  onClick={() => handleItemClick(n)}
                  className={`block border-b border-line px-4 py-3 text-sm transition last:border-b-0 hover:bg-card ${n.read ? "text-text-soft" : "text-text bg-signal-tint/70"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={n.read ? "" : "font-medium"}>{n.message}</span>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C5CFF]" />}
                  </div>
                  <span className="mt-1 block font-mono text-[11px] text-text-faint">{timeAgo(n.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
