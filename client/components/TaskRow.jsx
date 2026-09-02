"use client";

import { CATEGORIES, PRIORITIES } from "@/lib/constants";

const STATUS_STYLES = {
  todo: "bg-ink-2 text-text-soft border-line",
  in_progress: "bg-signal-tint text-[#7C5CFF] border-[#7C5CFF]/30",
  done: "bg-[#132A24] text-[#22D3A6] border-[#22D3A6]/30",
};
const STATUS_LABELS = { todo: "To do", in_progress: "In progress", done: "Done" };

export default function TaskRow({ task, goal, assigneeName, onCycleStatus, onEdit, onDelete, onComment, canDelete = true }) {
  const meta = goal ? CATEGORIES[goal.category] || CATEGORIES.other : null;
  // Tasks created before the field existed have no priority — treat as medium,
  // same rule as the server (db/tasks.js) and the voice parser.
  const priority = PRIORITIES[task.priority] || PRIORITIES.medium;
  const done = task.status === "done";

  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          onClick={() => onCycleStatus(task)}
          className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition hover:scale-[1.02] ${STATUS_STYLES[task.status]}`}
          title="Click to change status"
        >
          {STATUS_LABELS[task.status]}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${done ? "line-through text-text-faint" : "text-text"}`}>
            {task.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${
                done ? "border-line text-text-faint" : "text-text-soft"
              }`}
              style={done ? undefined : { borderColor: `${priority.color}55` }}
              title={`${priority.label} priority`}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: priority.color, opacity: done ? 0.5 : 1 }}
              />
              {priority.label}
            </span>
            {goal && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-faint">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                {goal.label}
              </span>
            )}
            {task.dueDate && (
              <span className="font-mono text-[10px] text-text-faint">due {task.dueDate}</span>
            )}
            {assigneeName && (
              <span className="rounded-full bg-ink-2 border border-line px-2 py-0.5 font-mono text-[10px] text-text-soft">
                @{assigneeName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onComment(task)}
          aria-label="Comments"
          className="rounded-lg p-2 text-text-faint transition hover:bg-card hover:text-text"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label="Edit task"
          className="rounded-lg p-2 text-text-faint transition hover:bg-card hover:text-text"
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
            className="rounded-lg p-2 text-text-faint transition hover:bg-error-tint hover:text-[#FF5D73]"
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
