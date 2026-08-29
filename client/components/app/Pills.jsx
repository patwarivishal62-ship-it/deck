"use client";

// Segmented pill filters + small chips, shared across pages for one
// consistent control style.

const activePill =
  "border-[#7C5CFF]/30 bg-signal-tint text-signal shadow-[0_2px_8px_-4px_rgba(124,92,255,0.45)]";
const idlePill = "border-line bg-card text-text-soft hover:border-line hover:text-text";

export function SegmentedControl({ options, value, onChange, ariaLabel, size = "md" }) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-[12.5px]";
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`rounded-full border font-semibold transition duration-150 ${pad} ${
              active ? activePill : idlePill
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={`ml-1.5 font-bold ${active ? "text-[#7C5CFF]" : "text-text-faint"}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ children, tone = "muted", className = "" }) {
  const tones = {
    muted: "bg-paper-2 text-text-soft",
    accent: "bg-signal-tint text-signal",
    positive: "bg-good-tint text-good-text",
    warning: "bg-warn-tint text-warn-text",
    danger: "bg-error-tint text-error-text",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.muted} ${className}`}
    >
      {children}
    </span>
  );
}

// Light select matching the pill family.
export function LightSelect({ children, className = "", ariaLabel, ...rest }) {
  return (
    <select
      aria-label={ariaLabel}
      className={`h-9 cursor-pointer rounded-xl border border-line bg-card px-3 text-[13px] font-medium text-text outline-none transition hover:border-line focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
