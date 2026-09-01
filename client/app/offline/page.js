"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { Button } from "@/components/FormControls";
import { useTheme } from "@/lib/ThemeContext";

export default function OfflinePage() {
  const { theme } = useTheme();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />

      <div className="relative w-full max-w-[400px] text-center">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5" aria-label="DECK home">
          <Logo variant={theme === "dark" ? "light" : "dark"} size={36} />
        </Link>

        <div className="rounded-2xl border border-line bg-card p-7 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-ink-2 text-text-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 15l4-6 3.5 4L14 9l3 4.5" />
              <path d="M2.5 19.5h19" />
            </svg>
          </span>
          <h1 className="font-display text-xl font-bold tracking-tight text-text">You’re offline</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-soft">
            DECK needs a connection to sync your projects. Pages you’ve already opened still work —
            reconnect and try again.
          </p>
          <div className="mt-5">
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        </div>

        <p className="mt-6 font-mono text-xs text-text-faint">OFFLINE — DECK</p>
      </div>
    </div>
  );
}
