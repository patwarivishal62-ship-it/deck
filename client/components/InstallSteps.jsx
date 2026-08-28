"use client";

/**
 * Platform-specific "how to install" steps, shared by the install modal,
 * the settings card, and the /download page.
 */

function StepIcon({ children }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-2 text-text-soft">
      {children}
    </span>
  );
}

function ShareGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function PlusBoxGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function DownloadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function MonitorGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  );
}

function CompassGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  );
}

const STEPS = {
  ios: [
    { icon: <CompassGlyph />, title: "Open DECK in Safari", sub: "on your iPhone or iPad" },
    { icon: <ShareGlyph />, title: "Tap the Share button", sub: "the square with an arrow, at the bottom" },
    { icon: <PlusBoxGlyph />, title: "Tap “Add to Home Screen”", sub: "scroll down if you don’t see it" },
    { icon: <PhoneGlyph />, title: "Tap Add", sub: "DECK now lives on your home screen" },
  ],
  android: [
    { icon: <MenuGlyph />, title: "Tap the ⋮ menu", sub: "in the Chrome address bar" },
    { icon: <DownloadGlyph />, title: "Tap “Install app”", sub: "or “Add to Home screen”" },
    { icon: <PhoneGlyph />, title: "Confirm Install", sub: "DECK lands on your home screen" },
  ],
  desktop: [
    { icon: <MonitorGlyph />, title: "Click the install icon", sub: "in the address bar (Chrome or Edge)" },
    { icon: <DownloadGlyph />, title: "Click Install", sub: "or use the ⋮ menu → “Install DECK…”" },
  ],
};

export function InstallSteps({ platform }) {
  const steps = STEPS[platform] || STEPS.desktop;
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-start gap-3.5">
          <span className="mt-0.5 font-mono text-xs font-semibold text-text-faint">{String(i + 1).padStart(2, "0")}</span>
          <StepIcon>{step.icon}</StepIcon>
          <span>
            <span className="block text-sm font-semibold text-text">{step.title}</span>
            <span className="block text-xs text-text-soft">{step.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const PLATFORM_LABELS = {
  ios: "iPhone / iPad",
  android: "Android",
  desktop: "Desktop",
};
