import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="border-t border-[#232A36] bg-[#0B0F14]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 sm:py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-3">
            <Logo variant="light" size={28} />
            <p className="max-w-sm text-sm leading-relaxed text-[#B8C0CC]">
              Professional, minimal work control. Plan campaigns, track goals, achieve outcomes — without the noise.
            </p>
          </div>
          <nav className="flex items-center gap-6 text-sm text-[#B8C0CC]">
            <Link href="/privacy-policy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <a href="mailto:contact@planyourdeck.com" className="transition hover:text-white">
              Support
            </a>
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t border-[#232A36] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#7A8599]">© 2026 DECK — Plan. Track. Achieve. All rights reserved.</p>
          <p className="text-xs text-[#7A8599]">Built for teams that ship — quietly powerful.</p>
        </div>
      </div>
    </footer>
  );
}
