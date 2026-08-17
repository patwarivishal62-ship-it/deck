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
        className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-2.5 transition hover:border-[#7C5CFF]/40 hover:bg-card"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] font-mono text-[11px] font-semibold text-white">
          {initialsFor(user)}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-text/60 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-text">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-text-faint">{user.email}</p>
          </div>

          <nav className="py-1.5">
            <Link
              href="/team"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-2 text-sm text-text transition hover:bg-ink-2"
            >
              <span>Workspaces</span>
              {workspaceCount !== null && (
                <span className="rounded-full bg-ink-2 px-1.5 py-0.5 font-mono text-xs text-text-soft">{workspaceCount}</span>
              )}
            </Link>
            <Link
              href="/calendar"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-text transition hover:bg-ink-2"
            >
              Calendar
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-text transition hover:bg-ink-2"
            >
              Settings
            </Link>
            <Link
              href="/admin/branding"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-text transition hover:bg-ink-2"
            >
              Branding
            </Link>
          </nav>

          <div className="border-t border-line py-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="block w-full px-4 py-2 text-left text-sm font-medium text-[#FF5D73] transition hover:bg-[#2E1A1E]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
