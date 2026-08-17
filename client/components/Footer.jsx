"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useTheme } from "@/lib/ThemeContext";

export default function Footer() {
  const { theme } = useTheme();
  const logoVariant = theme === "dark" ? "light" : "dark";
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-3">
            <Logo variant={logoVariant} size={28} />
            <p className="max-w-sm text-sm leading-relaxed text-text-soft">
              Professional, minimal work control. Plan campaigns, track goals, achieve outcomes — without the noise.
            </p>
          </div>
          <nav className="flex items-center gap-6 text-sm text-text-soft">
            <Link href="/privacy-policy" className="transition hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-text">
              Terms
            </Link>
            <a href="mailto:contact@planyourdeck.com" className="transition hover:text-text">
              Support
            </a>
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-faint">© 2026 DECK — Plan. Track. Achieve. All rights reserved.</p>
          <p className="text-xs text-text-faint">Built for teams that ship — quietly powerful.</p>
        </div>
      </div>
    </footer>
  );
}
