"use client";

// Now uses the uploaded favicon.png (/icon.png) as the brand mark.
// Keeps same API (size, variant, etc.) so TopBar/Footer/page.js require no changes.

export function DeckIcon({ size = 28 }) {
  return (
    <img
      src="/favicon.png"
      alt="DECK"
      width={size}
      height={size}
      className="shrink-0 object-contain select-none"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      draggable={false}
    />
  );
}

export function DeckMark({ size = 32, variant = "dark", withWordmark = true, compact = false }) {
  const isDark = variant === "dark";
  const textColor = isDark ? "#0B0F14" : "#FFFFFF";
  const subColor = isDark ? "#6B7280" : "#B8C0CC";

  return (
    <div className="flex items-center gap-3">
      <DeckIcon size={size} />
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
  const isDark = variant === "dark";

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/favicon.png"
        alt="DECK"
        width={size}
        height={size}
        className="shrink-0 object-contain select-none"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
        draggable={false}
      />
      <span
        className={`font-display font-bold tracking-[0.14em] ${isDark ? "text-[#0B0F14]" : "text-white"}`}
        style={{ fontSize: "17px" }}
      >
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
