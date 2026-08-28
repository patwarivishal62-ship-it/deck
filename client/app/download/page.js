"use client";

import TopBar from "@/components/TopBar";
import InstallButton from "@/components/InstallButton";
import { InstallSteps, PLATFORM_LABELS } from "@/components/InstallSteps";
import { usePWA } from "@/lib/PWAContext";

const PLATFORMS = [
  {
    id: "ios",
    title: "iPhone & iPad",
    blurb: "Safari · Add to Home Screen",
  },
  {
    id: "android",
    title: "Android",
    blurb: "Chrome · Install app",
  },
  {
    id: "desktop",
    title: "Desktop",
    blurb: "Chrome, Edge · Address bar",
  },
];

const PERKS = [
  {
    title: "Its own window",
    sub: "DECK opens full-screen, straight from your home screen or dock — no browser tabs.",
    icon: (
      <path d="M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M10.5 18.5h3" />
    ),
  },
  {
    title: "Works offline",
    sub: "The app shell loads even without a connection; your data syncs the moment you're back.",
    icon: <path d="M3 15l4-6 3.5 4L14 9l3 4.5 M2.5 19.5h19" />,
  },
  {
    title: "Always up to date",
    sub: "Updates arrive silently in the background — nothing to download or reinstall.",
    icon: <path d="M21 12a9 9 0 1 1-2.6-6.4 M21 3v5h-5" />,
  },
  {
    title: "Nothing to manage",
    sub: "No App Store, no installers, almost no storage. It's the same DECK account everywhere.",
    icon: <path d="M12 3v12 M7 11l5 5 5-5 M5 20h14" />,
  },
];

export default function DownloadPage() {
  const { platform, installed } = usePWA();

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />

      <main className="relative overflow-hidden">
        {/* subtle glows */}
        <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-[500px] w-[600px] rounded-full bg-[#4F7BFF]/[0.05] blur-[100px]" />

        {/* Hero */}
        <section className="relative mx-auto max-w-3xl px-4 pt-14 text-center sm:px-5 sm:pt-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Get the app
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Take DECK everywhere
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-text-soft">
            Install DECK on your desktop or phone in one tap. Same account, same projects — in a
            faster, full-screen app that lives next to your native ones.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {installed ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-5 py-3 text-sm font-medium text-good">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                DECK is installed on this device
              </p>
            ) : (
              <InstallButton label={`Install DECK — ${PLATFORM_LABELS[platform]}`} className="px-6" />
            )}
            <p className="text-xs text-text-faint">Free · No App Store · ~10 seconds</p>
          </div>
        </section>

        {/* Per-platform steps */}
        <section className="relative mx-auto max-w-5xl px-4 py-14 sm:px-5 sm:py-16" aria-label="Installation steps by platform">
          <div className="grid gap-5 md:grid-cols-3">
            {PLATFORMS.map((p) => {
              const current = platform === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-5 shadow-card transition ${
                    current ? "border-[#7C5CFF]/50 bg-card ring-1 ring-[#7C5CFF]/25" : "border-line bg-card"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold tracking-tight text-text">{p.title}</h2>
                    {current && (
                      <span className="rounded-full bg-[#7C5CFF]/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#7C5CFF]">
                        Your device
                      </span>
                    )}
                  </div>
                  <p className="mb-4 text-xs text-text-faint">{p.blurb}</p>
                  <InstallSteps platform={p.id} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Why install */}
        <section className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-5 sm:pb-20" aria-label="Why install the app">
          <div className="grid gap-5 sm:grid-cols-2">
            {PERKS.map((perk) => (
              <div key={perk.title} className="flex items-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-2 text-signal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {perk.icon}
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">{perk.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-text-soft">{perk.sub}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-text-faint">
            DECK installs as a Progressive Web App (PWA) on this device — your account and data live in
            the cloud and are shared with the web app at planyourdeck.com.
          </p>
        </section>
      </main>
    </div>
  );
}
