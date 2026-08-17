"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/calendar", label: "Calendar" },
  { href: "/team", label: "Team" },
];

export default function TopBar() {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#232A36] bg-[#0B0F14]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0B0F14]/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="flex items-center gap-2.5 transition opacity-100 hover:opacity-90" aria-label="DECK — Home">
            <Logo variant="light" size={32} />
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      active ? "bg-[#161B22] text-white border border-[#232A36]" : "text-[#B8C0CC] hover:text-white hover:bg-[#161B22]/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {user ? (
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <div className="ml-1 h-6 w-px bg-[#232A36]" />
            <UserMenu />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex rounded-full px-4 py-1.5 text-sm font-medium text-[#B8C0CC] transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center rounded-full bg-[#7C5CFF] px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,92,255,0.35)] transition hover:bg-[#6A44FF] hover:shadow-[0_0_28px_rgba(124,92,255,0.45)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
