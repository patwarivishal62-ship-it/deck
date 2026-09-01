"use client";

import Meter from "./Meter";
import { CATEGORIES, periodLabel } from "@/lib/constants";

export default function GoalCard({ goal, onEdit, onDelete, canManage = true }) {
  const meta = CATEGORIES[goal.category] || CATEGORIES.other;
  const pct = goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0;

  return (
    <div className="rounded-2xl border border-line bg-card p-4 transition hover:border-[#7C5CFF]/20">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">
              {meta.label}
              {goal.platform ? ` · ${goal.platform}` : ""}
            </span>
          </div>
          <h4 className="mt-1.5 truncate font-display text-sm font-semibold tracking-tight text-text">{goal.label}</h4>
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onEdit(goal)}
              aria-label="Edit goal"
              className="rounded-lg p-1.5 text-text-faint transition hover:bg-ink-2 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(goal)}
              aria-label="Delete goal"
              className="rounded-lg p-1.5 text-text-faint transition hover:bg-error-tint hover:text-[#FF5D73]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <Meter value={goal.currentValue} target={goal.targetValue} color={meta.color} />

      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-xs text-text-soft">
          {goal.currentValue}
          {goal.unit ? ` ${goal.unit}` : ""} / {goal.targetValue}
          {goal.unit ? ` ${goal.unit}` : ""}
          <span className="ml-1.5 text-text-faint">· {periodLabel(goal.period)}</span>
        </span>
        <span className="rounded-full bg-ink-2 border border-line px-2 py-0.5 font-mono text-xs font-medium text-text">{pct}%</span>
      </div>
    </div>
  );
}
