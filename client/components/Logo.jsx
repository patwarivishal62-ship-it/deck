"use client";

import { useBranding } from "@/lib/BrandingContext";
import { BRANDING_ENABLED } from "@/lib/featureFlags";

export function DeckIcon({ size = 28, variant = "dark" }) {
  // variant: dark for use on light bg (charcoal D), light for use on dark bg (white D)
  const isDark = variant === "dark";
  const dFill = isDark ? "#0B0F14" : "#FFFFFF";
  const bg = isDark ? "#FFFFFF" : "#0B0F14";
  const wedge = "#7C5CFF";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Rounded container */}
      <rect width="100" height="100" rx="22" fill={bg} />
      {/* D */}
      <path fill={dFill} d="M 22 16 H 52.5 C 70.2 16 84.5 28.2 84.5 50 C 84.5 71.8 70.2 84 52.5 84 H 34.2 V 56.2 H 52.5 C 60.8 56.2 66.5 52.1 66.5 49.9 C 66.5 47.7 60.8 43.6 52.5 43.6 H 40.2 V 16 H 22 Z" />
      <rect x="22" y="16" width="18" height="42" fill={dFill} />
      {/* diagonal gap */}
      <path d="M 22 68.5 L 35.2 54.2 L 37.8 54.2 L 24.6 68.8 Z" fill={bg} />
      {/* wedge */}
      <path fill={wedge} d="M 24.2 76.2 L 39.2 60.2 L 56.2 60.2 L 56.2 84 L 26.2 84 C 23.2 84 22 82.5 22 79.2 L 24.2 76.2 Z" />
    </svg>
  );
}

export function DeckMark({ size = 32, variant = "dark", withWordmark = true, compact = false }) {
  const isDark = variant === "dark";
  const textColor = isDark ? "#0B0F14" : "#FFFFFF";
  const subColor = isDark ? "#6B7280" : "#B8C0CC";

  return (
    <div className="flex items-center gap-3">
      <DeckIcon size={size} variant={variant} />
      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className="font-display font-extrabold tracking-[0.14em] antialiased"
            style={{ color: textColor, fontSize: compact ? "18px" : "19px", letterSpacing: "0.14em", lineHeight: 1 }}
          >
            DECK
          </span>
          {!compact && (
            <span className="mt-[2px] text-[10px] font-medium tracking-[0.18em] uppercase" style={{ color: subColor }}>
              Plan. Track. Achieve.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Logo({ variant = "dark", size = 28, showTagline = false }) {
  // Try to use dynamic branding if available (safe if provider missing).
  // While the branding feature is disabled the context never holds a logo,
  // so this always falls through to the built-in DECK mark below.
  let branding = null;
  try {
    const ctx = useBranding();
    if (BRANDING_ENABLED && ctx?.enabled) branding = ctx.branding;
  } catch {}
  if (branding?.logoUrl) {
    return (
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt="DECK" width={size} height={size} className="shrink-0 rounded-lg object-contain" style={{ width: size, height: size }} />
        <span className={`font-display font-bold tracking-[0.14em] ${variant === "dark" ? "text-[#0B0F14]" : "text-white"}`} style={{ fontSize: "17px" }}>
          DECK
        </span>
        {showTagline && (
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint ml-1 border-l border-border pl-3">
            Plan. Track. Achieve.
          </span>
        )}
      </div>
    );
  }

  const isDark = variant === "dark";
  const dFill = isDark ? "#0B0F14" : "#FFFFFF";
  const bg = isDark ? "transparent" : "transparent";

  // Minimal header logo: just geometric D + DECK wordmark, no tagline in nav
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
        {bg !== "transparent" && <rect width="100" height="100" rx="20" fill={bg} />}
        <path fill={dFill} d="M 22 16 H 52.5 C 70.2 16 84.5 28.2 84.5 50 C 84.5 71.8 70.2 84 52.5 84 H 34.2 V 56.2 H 52.5 C 60.8 56.2 66.5 52.1 66.5 49.9 C 66.5 47.7 60.8 43.6 52.5 43.6 H 40.2 V 16 H 22 Z" />
        <rect x="22" y="16" width="18" height="42" fill={dFill} />
        <path d="M 22 68.5 L 35.2 54.2 L 37.8 54.2 L 24.6 68.8 Z" fill={isDark ? "#FFFFFF" : "#0B0F14"} />
        <path fill="#7C5CFF" d="M 24.2 76.2 L 39.2 60.2 L 56.2 60.2 L 56.2 84 L 26.2 84 C 23.2 84 22 82.5 22 79.2 L 24.2 76.2 Z" />
      </svg>
      <span className={`font-display font-bold tracking-[0.14em] ${isDark ? "text-[#0B0F14]" : "text-white"}`} style={{ fontSize: "17px" }}>
        DECK
      </span>
      {showTagline && (
        <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint ml-1 border-l border-border pl-3">
          Plan. Track. Achieve.
        </span>
      )}
    </div>
  );
}
