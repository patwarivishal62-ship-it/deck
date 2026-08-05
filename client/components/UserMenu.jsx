"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

function initialsFor(user) {
  const source = user.name || user.email || "?";
  return source.trim().charAt(0).toUpperCase();
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [workspaceCount, setWorkspaceCount] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // A small, quiet touch — shows how many workspaces you're part of next to
  // the "Workspaces" item, without making workspace creation itself a
  // spotlighted action anywhere in this menu.
  useEffect(() => {
    if (!open || workspaceCount !== null) return;
    api
      .listWorkspaces()
      .then((data) => setWorkspaceCount(data.workspaces.length))
      .catch(() => {});
  }, [open, workspaceCount]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-ink-line py-1 pl-1 pr-2.5 transition hover:border-signal"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal font-mono text-[11px] font-semibold text-white">
          {initialsFor(user)}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-white/60 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-lg border border-line bg-card shadow-2xl">
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-sm font-medium text-text">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-text-faint">{user.email}</p>
          </div>

          <nav className="py-1">
            <Link
              href="/team"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-3.5 py-2 text-sm text-text transition hover:bg-paper"
            >
              <span>Workspaces</span>
              {workspaceCount !== null && (
                <span className="font-mono text-xs text-text-faint">{workspaceCount}</span>
              )}
            </Link>
            <Link
              href="/calendar"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-text transition hover:bg-paper"
            >
              Calendar
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-text transition hover:bg-paper"
            >
              Settings
            </Link>
          </nav>

          <div className="border-t border-line py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="block w-full px-3.5 py-2 text-left text-sm text-signal-deep transition hover:bg-signal-tint"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
