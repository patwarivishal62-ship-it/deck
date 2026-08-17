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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-3">
          <Logo variant={logoVariant} size={22} />
          <span className="hidden sm:inline h-4 w-px bg-line" />
          <span className="text-xs text-text-faint">© 2026 DECK</span>
        </div>

        <nav className="flex items-center gap-5 text-xs font-medium text-text-soft">
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-text-faint transition hover:border-signal/30 hover:text-signal hover:bg-signal-tint"
          >
            <InstagramIcon width={14} height={14} />
          </a>
          <a
            href="https://www.facebook.com/planyourdeck"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="DECK on Facebook"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-text-faint transition hover:border-signal/30 hover:text-signal hover:bg-signal-tint"
          >
            <FacebookIcon width={14} height={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
