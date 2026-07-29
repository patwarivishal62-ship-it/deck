"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";

export default function TopBar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/projects" className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-display text-base font-semibold text-white">Deck</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
            Project Control Center
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        )}
      </div>
    </header>
  );
}
