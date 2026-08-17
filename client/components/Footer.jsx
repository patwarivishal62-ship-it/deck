"use client";

import Link from "next/link";
import Logo from "./Logo";
import { useTheme } from "@/lib/ThemeContext";

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.5 8.5h2V4.2c-.4-.06-1.7-.2-3.3-.2-3.2 0-5.4 2-5.4 5.6v3.1H4.6V16h3.2v5.1h3.9V16h2.9l.5-3.3h-3.4v-2c0-1 .3-1.7 1.8-1.7z" />
    </svg>
  );
}

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
          <div className="flex flex-col items-end gap-4 sm:items-end">
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
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/planyourdeck/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="DECK on Instagram"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-text-faint transition hover:border-signal/30 hover:text-signal hover:bg-signal-tint"
              >
                <InstagramIcon width={16} height={16} />
              </a>
              <a
                href="https://www.facebook.com/planyourdeck"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="DECK on Facebook"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-text-faint transition hover:border-signal/30 hover:text-signal hover:bg-signal-tint"
              >
                <FacebookIcon width={16} height={16} />
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-faint">© 2026 DECK — Plan. Track. Achieve. All rights reserved.</p>
          <div className="flex items-center gap-3 text-xs text-text-faint">
            <span>Built for teams that ship — quietly powerful.</span>
            <span className="hidden sm:inline h-1 w-1 rounded-full bg-line" />
            <span className="hidden sm:inline">Follow us on Instagram & Facebook</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
