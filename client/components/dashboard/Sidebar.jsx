"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  CalendarDays,
  BarChart3,
  FileText,
  Settings,
  CircleHelp,
} from "lucide-react";
import Logo from "@/components/Logo";

// Primary + bottom navigation for the signed-in app shell. Every item links
// to a live screen.
const PRIMARY_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/personal", label: "Tasks", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
];

const BOTTOM_NAV = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: CircleHelp },
];

function NavItem({ item, pathname, onNavigate }) {
  const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
  const icon = <item.icon size={18} strokeWidth={1.8} className="shrink-0" />;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition duration-150 ${
        active
          ? "bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)]"
          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {icon}
      {item.label}
    </Link>
  );
}

// Deep-navy sidebar from the reference. Rendered fixed on desktop (lg+) and
// inside a slide-in drawer on smaller screens (the drawer wrapper lives in
// the app shell; `onNavigate` lets it close after a tap).
export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[248px] flex-col bg-[#0F172A]" data-theme="dark">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-5">
        <Link href="/dashboard" onClick={onNavigate} aria-label="DECK dashboard" className="transition hover:opacity-90">
          <Logo variant="light" size={30} />
        </Link>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {/* Bottom navigation */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-3">
        <div className="space-y-1">
          {BOTTOM_NAV.map((item) => (
            <NavItem key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </aside>
  );
}
