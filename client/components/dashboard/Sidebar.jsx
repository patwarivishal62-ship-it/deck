"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  CheckSquare,
  Calendar,
  BarChart2,
  FileText,
  Plug,
  Settings,
  HelpCircle,
} from "lucide-react";

const PRIMARY = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/personal", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/overview#analytics", label: "Analytics", icon: BarChart2 },
  { href: "/overview#reports", label: "Reports", icon: FileText },
  { href: "/overview#integrations", label: "Integrations", icon: Plug },
];

const BOTTOM = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/download", label: "Help", icon: HelpCircle },
];

function NavItem({ href, label, icon: Icon, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150 ${
        active
          ? "bg-[#5146F5] text-white shadow-[0_4px_12px_rgba(81,70,245,0.35)]"
          : "text-[#B7BED0] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon size={15} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function Sidebar({ onNavigate }) {
  const pathname = usePathname();

  function isActive(href) {
    const path = href.split("#")[0];
    if (path === "/overview") return (pathname === "/overview" || pathname === "/") && !href.includes("#");
    return pathname === path || pathname?.startsWith(`${path}/`);
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-gradient-to-b from-[#121A36] to-[#0E1630] px-3 py-4">
      <Link href="/overview" onClick={onNavigate} className="mb-6 flex items-center gap-2 px-1.5 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5146F5]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7z" stroke="white" strokeWidth="1.8" />
            <path d="M12 12l8-4.5M12 12v8M12 12L4 7.5" stroke="white" strokeWidth="1.8" />
          </svg>
        </span>
        <span className="text-[15px] font-bold tracking-[0.12em] text-white">DECK</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {PRIMARY.map((item) => (
          <NavItem
            key={item.label}
            {...item}
            active={item.label === "Overview" ? pathname === "/overview" || pathname === "/" : isActive(item.href)}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <nav className="mt-auto flex flex-col gap-0.5 pb-1 pt-8">
        {BOTTOM.map((item) => (
          <NavItem key={item.label} {...item} active={isActive(item.href)} onClick={onNavigate} />
        ))}
      </nav>
    </aside>
  );
}
