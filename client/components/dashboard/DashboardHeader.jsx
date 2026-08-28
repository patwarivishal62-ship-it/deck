"use client";

import { Menu, Search } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import UserMenu from "@/components/UserMenu";

// Sticky header for the post-login dashboard: rounded search field on the
// left, notification bell + circular account avatar on the right. The bell
// and account menu are the app's existing components — the page renders the
// dashboard inside a light theme scope so they match this UI.
export default function DashboardHeader({ search, onSearchChange, onOpenMenu }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E9EDF3] bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Mobile: open sidebar drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#31405A] transition hover:bg-[#F1F4F9] lg:hidden"
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>

        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search
            size={16}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A94A6]"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects or tasks…"
            aria-label="Search projects or tasks"
            className="h-10 w-full rounded-full border border-[#E4E9F1] bg-white pl-10 pr-4 text-sm text-[#0F172A] outline-none transition placeholder:text-[#9AA5B5] hover:border-[#D6DEE9] focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationBell />
          <div className="ml-0.5 h-6 w-px bg-[#E9EDF3] sm:hidden" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
