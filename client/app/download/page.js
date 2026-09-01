"use client";

import TopBar from "@/components/TopBar";
import InstallButton from "@/components/InstallButton";
import { usePWA } from "@/lib/PWAContext";

const APK_HREF = "/downloads/deck.apk";

const APK_STEPS = [
  { n: "01", title: "Download", sub: "Tap the button above — the file saves to your phone." },
  { n: "02", title: "Allow install", sub: "If Android asks, allow installs from your browser." },
  { n: "03", title: "Open DECK", sub: "Open the file, tap Install — DECK lands on your home screen." },
];

export default function DownloadPage() {
  const { installed } = usePWA();

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />

        <section className="relative mx-auto max-w-2xl px-4 py-16 text-center sm:px-5 sm:py-24">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Get the app
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Download DECK
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-text-soft">
            Install DECK from your browser, or download the app for Android —
            same account, same projects.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {installed ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-5 py-3 text-sm font-medium text-good">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                DECK is installed on this device
              </p>
            ) : (
              <InstallButton label="Install DECK" className="px-6" />
            )}
            <a
              href={APK_HREF}
              download="DECK.apk"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#7C5CFF] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,92,255,0.35)] transition hover:bg-[#6A44FF]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="M7 11l5 5 5-5" />
                <path d="M5 20h14" />
              </svg>
              Download DECK
            </a>
          </div>

          <ol className="mx-auto mt-12 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
            {APK_STEPS.map((step) => (
              <li key={step.n} className="rounded-xl border border-line bg-card px-4 py-3 shadow-card">
                <p className="font-mono text-[10px] font-semibold text-text-faint">{step.n}</p>
                <p className="mt-1 text-sm font-semibold text-text">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-soft">{step.sub}</p>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-xs text-text-faint">Free · Phone and desktop</p>
        </section>
      </main>
    </div>
  );
}
