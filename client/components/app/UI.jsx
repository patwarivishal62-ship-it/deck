"use client";

import { getProjectStatus } from "@/lib/projectStatus";

// Status pill colors — one source of truth for the whole platform (Overview
// cards, Projects list, Analytics table all render the same pill).
export const STATUS_PILLS = {
  completed: { label: "Completed", bg: "#E7F6EF", color: "#0E9F6E", dot: "#12B76A" },
  in_progress: { label: "In progress", bg: "#F1EDFF", color: "#6D4FE0", dot: "#7C5CFF" },
  pending: { label: "Pending", bg: "#F1F4F9", color: "#5B6B7F", dot: "#8A94A6" },
};

export default function StatusPill({ project, className = "" }) {
  return <StatusPillForStatus status={getProjectStatus(project)} className={className} />;
}

// Same pill when the caller already knows the derived status string.
export function StatusPillForStatus({ status, className = "" }) {
  const pill = STATUS_PILLS[status] || STATUS_PILLS.pending;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
      style={{ backgroundColor: pill.bg, color: pill.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
      {pill.label}
    </span>
  );
}

// Thin gradient progress bar identical to the Overview project cards.
export function ProgressBar({ value, label, className = "" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-paper-2 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || "Progress"}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Dashed empty state with icon, used wherever a list can be empty.
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-6 py-12 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
          <Icon size={20} strokeWidth={1.8} />
        </span>
      )}
      <p className="mt-3 text-sm font-semibold text-text">{title}</p>
      {children && <div className="mt-1 max-w-sm text-xs leading-relaxed text-text-faint">{children}</div>}
    </div>
  );
}

// Reusable error banner with a Retry action — matches the Overview banner.
export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-error-line bg-error-tint px-4 py-3 text-sm text-error-text">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

// Primary + secondary buttons in the reference style.
export function PrimaryButton({ children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-[#7C5CFF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)] transition duration-150 hover:bg-[#6A4AF0] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-card px-4 py-2 text-[13px] font-semibold text-text shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-150 hover:border-line hover:bg-paper active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
