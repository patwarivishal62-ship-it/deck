"use client";

import { Menu, Search } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import UserMenu from "@/components/UserMenu";

// Sticky header for the signed-in app shell: rounded search field on the
// left (optional — pages without search just skip it), notification bell +
// circular account avatar on the right. Fully theme-aware via tokens
// (bg-header, border-line, bg-card, text-text, …) so it follows the user's
// Dark / Light / Eye Care choice.
export default function DashboardHeader({
  search,
  onSearchChange,
  onOpenMenu,
  searchPlaceholder = "Search projects or tasks…",
}) {
  const hasSearch = typeof onSearchChange === "function";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-header pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Mobile: open sidebar drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text transition hover:bg-paper-2 lg:hidden"
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>

        {/* Search */}
        {hasSearch ? (
          <div className="relative w-full max-w-md">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full rounded-full border border-line bg-card pl-10 pr-4 text-sm text-text outline-none transition placeholder:text-text-faint hover:border-line focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10"
            />
          </div>
        ) : (
          <div className="hidden w-full max-w-md sm:block" aria-hidden="true" />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationBell />
          <div className="ml-0.5 h-6 w-px bg-paper-2 sm:hidden" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
