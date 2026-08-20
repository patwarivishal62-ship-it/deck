"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import UserMenu from "./UserMenu";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/calendar", label: "Calendar" },
  { href: "/personal", label: "Personal" },
  { href: "/team", label: "Team" },
];

export default function TopBar() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const logoVariant = theme === "dark" ? "light" : "dark";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/70 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="flex items-center gap-2.5 transition opacity-100 hover:opacity-90" aria-label="DECK — Home">
            <Logo variant={logoVariant} size={32} />
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
                      active ? "bg-card text-text border border-line" : "text-text-soft hover:text-text hover:bg-card/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <NotificationBell />
              <div className="ml-1 h-6 w-px bg-line" />
              <UserMenu />
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <Link href="/login" className="rounded-full px-4 py-1.5 text-sm font-medium text-text-soft transition hover:text-text">
                Sign in
              </Link>
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center rounded-full bg-signal px-4 py-1.5 text-sm font-semibold text-white shadow-glow transition hover:bg-signal-deep hover:shadow-glow-strong hover:scale-[1.02] active:scale-[0.98]"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
