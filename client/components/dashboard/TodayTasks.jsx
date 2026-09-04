"use client";

import Link from "next/link";
import { Check, Inbox, Plus } from "lucide-react";
import { CATEGORIES, PRIORITIES } from "@/lib/constants";
import { projectCategoryKey, todayISO } from "@/lib/dashboard";

// One task row: checkbox + title + related-project indicator + due chip.
// Only HIGH priority gets a marker here — the dashboard list is meant to stay
// scannable, and medium is the default for every task anyway.
function TaskItem({ task, onToggle, busy }) {
  const done = task.status === "done";
  const categoryKey = projectCategoryKey(task.project);
  const categoryColor = categoryKey ? CATEGORIES[categoryKey].color : "#7C5CFF";
  const overdue = !done && task.dueDate && task.dueDate < todayISO();
  const highPriority = !done && task.priority === "high";

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition duration-150 hover:border-line hover:bg-paper">
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        aria-pressed={done}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-150 ${
          done
            ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
            : "border-line bg-card hover:border-[#7C5CFF] hover:bg-signal-tint"
        } ${busy ? "opacity-60" : ""}`}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`flex min-w-0 items-center gap-1.5 text-sm font-medium ${
            done ? "text-text-faint line-through" : "text-text"
          }`}
        >
          {highPriority && (
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: PRIORITIES.high.color }}
              title="High priority"
              aria-label="High priority"
            />
          )}
          <span className="truncate">{task.title}</span>
        </p>
        {/* Project indicator on very small screens lives under the title */}
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-faint sm:hidden">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
          <span className="truncate">{task.project?.name}</span>
        </span>
      </div>

      {/* Related project indicator (desktop) */}
      <Link
        href={`/projects/${task.project?.id}`}
        className="hidden max-w-[180px] shrink-0 items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-text-soft transition hover:bg-paper-2 sm:inline-flex"
        title={task.project?.name}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
        <span className="truncate">{task.project?.name}</span>
      </Link>

      {/* Due chip */}
      {done ? (
        <span className="shrink-0 rounded-full bg-good-tint px-2.5 py-1 text-[11px] font-semibold text-good-text">Done</span>
      ) : overdue ? (
        <span className="shrink-0 rounded-full bg-error-tint px-2.5 py-1 text-[11px] font-semibold text-error-text">Overdue</span>
      ) : (
        <span className="shrink-0 rounded-full bg-signal-tint px-2.5 py-1 text-[11px] font-semibold text-signal">Today</span>
      )}
    </li>
  );
}

// Today's Tasks section list. Tasks come from real project data (due today /
// overdue / completed today). Empty and loading states included.
export default function TodayTasks({ tasks, loading, onToggle, togglingId, max = 6, onAdd }) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="h-5 w-5 animate-pulse rounded-md bg-paper-2" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-paper-2" />
            <div className="hidden h-6 w-24 animate-pulse rounded-full bg-paper-2 sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-signal-tint text-[#7C5CFF]">
          <Inbox size={20} strokeWidth={1.8} />
        </span>
        <p className="mt-3 text-sm font-semibold text-text">Nothing due today</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-text-faint">
          Tasks due today — or overdue — from your projects will show up here.
        </p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#7C5CFF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.7)] transition hover:bg-[#6A4AF0]"
          >
            <Plus size={15} strokeWidth={2.2} />
            Add task
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="rounded-2xl border border-line bg-card p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-16px_rgba(16,24,40,0.10)] sm:p-2">
      {tasks.slice(0, max).map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} busy={togglingId === task.id} />
      ))}
    </ul>
  );
}
