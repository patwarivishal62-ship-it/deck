"use client";

export default function Logo({ variant = "dark", size = 28, showTagline = false }) {
  const isDark = variant === "dark";

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/favicon.png"
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        className="shrink-0 rounded-[22%]"
      />
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
