"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import InstallButton from "@/components/InstallButton";
import { InstallSteps, PLATFORM_LABELS } from "@/components/InstallSteps";
import { usePWA } from "@/lib/PWAContext";

const APK_HREF = "/downloads/deck.apk";

const PLATFORMS = [
  {
    id: "ios",
    title: "iPhone & iPad",
    blurb: "Safari · Add to Home Screen",
  },
  {
    id: "android",
    title: "Android",
    blurb: "APK download or Chrome install",
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
    sub: "The website and the Android APK share the same account. Web updates arrive silently; grab a new APK when we ship one.",
    icon: <path d="M21 12a9 9 0 1 1-2.6-6.4 M21 3v5h-5" />,
  },
  {
    title: "Nothing to manage",
    sub: "No App Store required. Install from Chrome, or download the Android APK from this page.",
    icon: <path d="M12 3v12 M7 11l5 5 5-5 M5 20h14" />,
  },
];

const APK_STEPS = [
  { n: "01", title: "Download DECK.apk", sub: "Use the button above — it saves the file to your phone." },
  { n: "02", title: "Allow this source", sub: "Android may ask you to permit installs from the browser or Files app." },
  { n: "03", title: "Open the file", sub: "Tap DECK.apk, then Install. The app lands on your home screen." },
];

function formatBytes(n) {
  if (!n || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const { platform, installed } = usePWA();
  const [apk, setApk] = useState(null);

  useEffect(() => {
    fetch("/downloads/android.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setApk(data))
      .catch(() => setApk(null));
  }, []);

  const apkReady = Boolean(apk?.file);
  const apkSize = formatBytes(apk?.sizeBytes);
  const apkVersion = apk?.versionName || "1.0.0";

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-0 h-[500px] w-[600px] rounded-full bg-[#7C5CFF]/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-[500px] w-[600px] rounded-full bg-[#4F7BFF]/[0.05] blur-[100px]" />

        <section className="relative mx-auto max-w-3xl px-4 pt-14 text-center sm:px-5 sm:pt-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-signal">
            Get the app
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Take DECK everywhere
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-text-soft">
            Install DECK on your desktop or phone. On Android you can download a real APK —
            same account, same projects, as a home-screen app.
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
              Download Android APK
            </a>
          </div>
          <p className="mt-3 text-xs text-text-faint">
            Free · Android APK v{apkVersion}
            {apkSize ? ` · ${apkSize}` : ""}
            {apkReady ? "" : " · file publishes after the Android build"}
          </p>
        </section>

        <section className="relative mx-auto max-w-3xl px-4 pt-12 sm:px-5" aria-label="Download the Android APK">
          <div className="rounded-2xl border border-[#7C5CFF]/40 bg-card p-5 shadow-card ring-1 ring-[#7C5CFF]/20 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7C5CFF]">
                  Direct download
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-text">
                  Android APK
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-text-soft">
                  Sideload DECK as a real Android app. It opens planyourdeck.com in its own window —
                  no Play Store, no Chrome install prompt required.
                </p>
              </div>
              <a
                href={APK_HREF}
                download="DECK.apk"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#7C5CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6A44FF]"
              >
                Download DECK.apk
              </a>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {APK_STEPS.map((step) => (
                <li key={step.n} className="rounded-xl border border-line bg-paper px-4 py-3">
                  <p className="font-mono text-[10px] font-semibold text-text-faint">{step.n}</p>
                  <p className="mt-1 text-sm font-semibold text-text">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-soft">{step.sub}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-text-faint">
              Android will warn that the app is from outside the Play Store — that&apos;s expected for a
              direct APK. Only install from this site. Package name:{" "}
              <span className="font-mono">com.planyourdeck.app</span>
            </p>
          </div>
        </section>

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
                  {p.id === "android" ? (
                    <ol className="flex flex-col gap-4">
                      <li className="flex items-start gap-3.5">
                        <span className="mt-0.5 font-mono text-xs font-semibold text-text-faint">01</span>
                        <span>
                          <span className="block text-sm font-semibold text-text">Download the APK</span>
                          <span className="block text-xs text-text-soft">fastest — button at the top of this page</span>
                        </span>
                      </li>
                      <li className="flex items-start gap-3.5">
                        <span className="mt-0.5 font-mono text-xs font-semibold text-text-faint">02</span>
                        <span>
                          <span className="block text-sm font-semibold text-text">Or install from Chrome</span>
                          <span className="block text-xs text-text-soft">⋮ menu → Install app / Add to Home screen</span>
                        </span>
                      </li>
                    </ol>
                  ) : (
                    <InstallSteps platform={p.id} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

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
            The Android APK and the browser install both use your DECK account at planyourdeck.com.
            Your data lives in the cloud and stays in sync.
          </p>
        </section>
      </main>
    </div>
  );
}
