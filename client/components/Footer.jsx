import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-ink-line bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-text-faint sm:flex-row">
        <p>© 2026 Deck — Project Control Center · v1.1.0</p>
        <nav className="flex items-center gap-4">
          <Link href="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            Terms &amp; Conditions
          </Link>
          <a href="mailto:contact@planyourdeck.com" className="transition hover:text-white">
            Contact Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
