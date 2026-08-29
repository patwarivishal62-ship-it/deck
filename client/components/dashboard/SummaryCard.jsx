"use client";

// One of the three equal summary cards from the reference:
// small label, large value, small supporting info.

export default function SummaryCard({ label, value, info, infoTone = "muted", icon: Icon, iconBg, iconColor, loading }) {
  const tones = {
    muted: "text-text-faint",
    positive: "text-good-text",
    warning: "text-warn-text",
    danger: "text-error-text",
    accent: "text-signal",
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-text-soft">{label}</p>
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
        <div className="mt-2 h-8 w-20 animate-pulse rounded-lg bg-paper-2" />
      ) : (
        <p className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-text">{value}</p>
      )}

      {loading ? (
        <div className="mt-2 h-3.5 w-32 animate-pulse rounded bg-paper-2" />
      ) : (
        info && <p className={`mt-1.5 text-xs font-medium ${tones[infoTone] || tones.muted}`}>{info}</p>
      )}
    </div>
  );
}
