"use client";

// One of the three equal summary cards from the reference:
// small label, large value, small supporting info.

export default function SummaryCard({ label, value, info, infoTone = "muted", icon: Icon, iconBg, iconColor, loading }) {
  const tones = {
    muted: "text-[#8A94A6]",
    positive: "text-[#12976A]",
    warning: "text-[#C77714]",
    danger: "text-[#DC3D43]",
    accent: "text-[#6D4FE0]",
  };

  return (
    <div className="rounded-2xl border border-[#E9EDF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-[#5B6B7F]">{label}</p>
        {Icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            <Icon size={16} strokeWidth={1.8} />
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded-lg bg-[#EEF1F6]" />
      ) : (
        <p className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-[#0F172A]">{value}</p>
      )}

      {loading ? (
        <div className="mt-2 h-3.5 w-32 animate-pulse rounded bg-[#EEF1F6]" />
      ) : (
        info && <p className={`mt-1.5 text-xs font-medium ${tones[infoTone] || tones.muted}`}>{info}</p>
      )}
    </div>
  );
}
