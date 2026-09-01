"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import InstallButton from "@/components/InstallButton";
import { usePWA } from "@/lib/PWAContext";

const APK_HREF = "/downloads/deck.apk";

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
  const { installed } = usePWA();
  const [apk, setApk] = useState(null);

  useEffect(() => {
    fetch("/downloads/android.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setApk(data))
      .catch(() => setApk(null));
  }, []);

  const apkSize = formatBytes(apk?.sizeBytes);
  const apkVersion = apk?.versionName || "1.0.0";

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
            Install DECK from your browser, or grab the Android APK — same account, same projects.
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
              Download Android APK
            </a>
          </div>
          <p className="mt-3 text-xs text-text-faint">
            Free · Android APK v{apkVersion}
            {apkSize ? ` · ${apkSize}` : ""}
          </p>

          <ol className="mx-auto mt-12 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
            {APK_STEPS.map((step) => (
              <li key={step.n} className="rounded-xl border border-line bg-card px-4 py-3 shadow-card">
                <p className="font-mono text-[10px] font-semibold text-text-faint">{step.n}</p>
                <p className="mt-1 text-sm font-semibold text-text">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-soft">{step.sub}</p>
              </li>
            ))}
          </ol>

          <p className="mt-8 text-xs leading-relaxed text-text-faint">
            On iPhone, iPad, or desktop, use the Install button above and follow the steps shown.
            Android will warn that the APK is from outside the Play Store — that&apos;s expected for a
            direct download. Only install from this site.
          </p>
        </section>
      </main>
    </div>
  );
}
