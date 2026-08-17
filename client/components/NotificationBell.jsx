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
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#232A36] bg-[#161B22] text-white/80 transition hover:border-[#7C5CFF]/40 hover:text-white hover:bg-[#1A1F2A]"
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
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 overflow-hidden rounded-2xl border border-[#232A36] bg-[#161B22] shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between border-b border-[#232A36] px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-[#7C5CFF] hover:text-[#8B6DFF]">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center font-mono text-xs uppercase tracking-wide text-[#7A8599]">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#B8C0CC]">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/projects"}
                  onClick={() => handleItemClick(n)}
                  className={`block border-b border-[#232A36] px-4 py-3 text-sm transition last:border-b-0 hover:bg-[#1F242F] ${n.read ? "text-[#B8C0CC]" : "text-white bg-[#1E1C2E]/50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={n.read ? "" : "font-medium"}>{n.message}</span>
                    {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C5CFF]" />}
                  </div>
                  <span className="mt-1 block font-mono text-[11px] text-[#7A8599]">{timeAgo(n.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
