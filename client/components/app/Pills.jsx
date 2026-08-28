"use client";

// Segmented pill filters + small chips, shared across pages for one
// consistent control style.

const activePill =
  "border-[#7C5CFF]/30 bg-[#F1EDFF] text-[#6D4FE0] shadow-[0_2px_8px_-4px_rgba(124,92,255,0.45)]";
const idlePill = "border-[#E4E9F1] bg-white text-[#5B6B7F] hover:border-[#D6DEE9] hover:text-[#31405A]";

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
              <span className={`ml-1.5 font-bold ${active ? "text-[#7C5CFF]" : "text-[#9AA5B5]"}`}>
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
    muted: "bg-[#F1F4F9] text-[#5B6B7F]",
    accent: "bg-[#F1EDFF] text-[#6D4FE0]",
    positive: "bg-[#E7F6EF] text-[#0E9F6E]",
    warning: "bg-[#FEF4E4] text-[#C77714]",
    danger: "bg-[#FDEEEF] text-[#DC3D43]",
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
      className={`h-9 cursor-pointer rounded-xl border border-[#E4E9F1] bg-white px-3 text-[13px] font-medium text-[#31405A] outline-none transition hover:border-[#D6DEE9] focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
