"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import InstallButton from "@/components/InstallButton";
import { usePWA } from "@/lib/PWAContext";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Dismissible "install DECK" banner, shown once the browser says the app is
 * installable (or on iOS Safari, which never fires beforeinstallprompt).
 * Hidden when already installed, on /download, or for two weeks after a
 * dismissal (see PWAContext).
 */
export default function InstallBanner() {
  const { mounted, installed, canInstall, isIOS, dismissedRecently, dismissInstall } = usePWA();
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!mounted || installed || dismissedRecently || pathname?.startsWith("/download")) return;
    if (!canInstall && !isIOS) return;
    // Small delay so it doesn't compete with the first paint.
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [mounted, installed, dismissedRecently, canInstall, isIOS, pathname]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install DECK on your device"
      className="install-banner fixed inset-x-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-ink-2">
        <Logo variant={theme === "dark" ? "light" : "dark"} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">Install DECK</p>
        <p className="truncate text-xs text-text-soft">Full-screen, offline-ready, one tap away.</p>
      </div>
      <InstallButton variant="banner" label="Install" />
      <button
        type="button"
        aria-label="Not now"
        onClick={() => {
          setVisible(false);
          dismissInstall();
        }}
        className="shrink-0 rounded-full p-1.5 text-text-faint transition hover:bg-ink-2 hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
