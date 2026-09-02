"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import VoiceAssistant from "@/components/voice/VoiceAssistant";

// Shared shell for every signed-in screen — the deep-navy sidebar (fixed on
// desktop lg+, slide-in drawer on mobile), the sticky header, and the content
// area. The shell is fully theme-aware: surfaces and text use design tokens
// (bg-paper-2, text-text, border-line, …) that resolve per data-theme, so the
// user's Dark / Light / Eye Care choice restyles every signed-in page. The
// sidebar intentionally pins data-theme="dark" on itself to stay navy in all
// themes. One shell = one uniform platform: every page renders inside it with
// the same padding, background, and header behavior.
export default function AppShell({
  children,
  search = "",
  onSearchChange,
  searchPlaceholder = "Search projects or tasks…",
  projectId,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper-2 text-text">
      {/* Mobile sidebar drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute -right-11 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar />
      </div>

      <div className="lg:pl-[248px]">
        <DashboardHeader
          search={search}
          onSearchChange={onSearchChange}
          onOpenMenu={() => setDrawerOpen(true)}
          searchPlaceholder={searchPlaceholder}
        />

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-7 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Global Voice AI Assistant — available on every signed-in screen */}
      <VoiceAssistant projectId={projectId} />
    </div>
  );
}
