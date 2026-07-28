"use client";

import { CATEGORIES } from "@/lib/constants";

const STATUS_STYLES = {
  todo: "bg-paper text-text-soft border-line",
  in_progress: "bg-signal-tint text-signal-deep border-signal-tint",
  done: "bg-good/10 text-good border-good/30",
};
const STATUS_LABELS = { todo: "To do", in_progress: "In progress", done: "Done" };

export default function TaskRow({ task, goal, onCycleStatus, onEdit, onDelete, onComment, canDelete = true }) {
  const meta = goal ? CATEGORIES[goal.category] || CATEGORIES.other : null;

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={() => onCycleStatus(task)}
        className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide transition ${STATUS_STYLES[task.status]}`}
        title="Click to change status"
      >
        {STATUS_LABELS[task.status]}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm text-text ${task.status === "done" ? "line-through text-text-faint" : ""}`}>
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {goal && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-faint">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
              {goal.label}
            </span>
          )}
          {task.dueDate && (
            <span className="font-mono text-[10px] text-text-faint">due {task.dueDate}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onComment(task)}
          aria-label="Comments"
          className="rounded-md p-1 text-text-faint hover:bg-paper hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label="Edit task"
          className="rounded-md p-1 text-text-faint hover:bg-paper hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label="Delete task"
            className="rounded-md p-1 text-text-faint hover:bg-signal-tint hover:text-signal-deep"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
