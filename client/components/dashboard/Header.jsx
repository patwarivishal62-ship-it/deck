"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifyRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (notifyRef.current && !notifyRef.current.contains(e.target)) setNotifyOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AK";

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7B8498] transition-colors duration-150 hover:bg-[#EEF0F6] lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <label className="relative block">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA3B5]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tasks..."
            className="h-8 w-[148px] rounded-full border border-[#E8EAF0] bg-white pl-7 pr-3 text-[12px] text-[#172033] outline-none transition-shadow duration-150 placeholder:text-[#9AA3B5] focus:border-[#5146F5]/40 focus:shadow-[0_0_0_3px_rgba(81,70,245,0.12)] sm:w-[168px]"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={notifyRef}>
          <button
            type="button"
            onClick={() => setNotifyOpen((v) => !v)}
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7B8498] transition-colors duration-150 hover:bg-[#EEF0F6]"
          >
            <Bell size={16} strokeWidth={1.75} />
          </button>
          {notifyOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-xl border border-[#E8EAF0] bg-white p-3 text-[12px] text-[#7B8498] shadow-[0_12px_32px_rgba(23,32,51,0.12)]">
              You’re all caught up.
            </div>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6B5CFF] text-[11px] font-semibold text-white transition-transform duration-150 hover:scale-[1.03]"
          >
            {initials}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-44 overflow-hidden rounded-xl border border-[#E8EAF0] bg-white py-1 text-[13px] shadow-[0_12px_32px_rgba(23,32,51,0.12)]">
              <Link href="/settings" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-[#172033] hover:bg-[#F8F9FC]">
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="block w-full px-3 py-2 text-left text-[#FF5D73] hover:bg-[#FFF5F6]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
