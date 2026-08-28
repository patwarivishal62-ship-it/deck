"use client";

import Link from "next/link";
import { Check, Inbox } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import { projectCategoryKey, todayISO } from "@/lib/dashboard";

// One task row: checkbox + title + related-project indicator + due chip.
function TaskItem({ task, onToggle, busy }) {
  const done = task.status === "done";
  const categoryKey = projectCategoryKey(task.project);
  const categoryColor = categoryKey ? CATEGORIES[categoryKey].color : "#7C5CFF";
  const overdue = !done && task.dueDate && task.dueDate < todayISO();

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition duration-150 hover:border-[#E9EDF3] hover:bg-[#F8FAFD]">
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        aria-pressed={done}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-150 ${
          done
            ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
            : "border-[#C9D3E0] bg-white hover:border-[#7C5CFF] hover:bg-[#F7F5FF]"
        } ${busy ? "opacity-60" : ""}`}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            done ? "text-[#9AA5B5] line-through" : "text-[#0F172A]"
          }`}
        >
          {task.title}
        </p>
        {/* Project indicator on very small screens lives under the title */}
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8A94A6] sm:hidden">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
          <span className="truncate">{task.project?.name}</span>
        </span>
      </div>

      {/* Related project indicator (desktop) */}
      <Link
        href={`/projects/${task.project?.id}`}
        className="hidden max-w-[180px] shrink-0 items-center gap-1.5 rounded-full bg-[#F1F4F9] px-2.5 py-1 text-[11px] font-medium text-[#5B6B7F] transition hover:bg-[#E9EEF5] sm:inline-flex"
        title={task.project?.name}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />
        <span className="truncate">{task.project?.name}</span>
      </Link>

      {/* Due chip */}
      {done ? (
        <span className="shrink-0 rounded-full bg-[#E7F6EF] px-2.5 py-1 text-[11px] font-semibold text-[#0E9F6E]">Done</span>
      ) : overdue ? (
        <span className="shrink-0 rounded-full bg-[#FDEEEF] px-2.5 py-1 text-[11px] font-semibold text-[#DC3D43]">Overdue</span>
      ) : (
        <span className="shrink-0 rounded-full bg-[#F1EDFF] px-2.5 py-1 text-[11px] font-semibold text-[#6D4FE0]">Today</span>
      )}
    </li>
  );
}

// Today's Tasks section list. Tasks come from real project data (due today /
// overdue / completed today). Empty and loading states included.
export default function TodayTasks({ tasks, loading, onToggle, togglingId, max = 6 }) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
            <div className="h-5 w-5 animate-pulse rounded-md bg-[#EEF1F6]" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-[#EEF1F6]" />
            <div className="hidden h-6 w-24 animate-pulse rounded-full bg-[#EEF1F6] sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E4E9F1] bg-white/60 px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F1EDFF] text-[#7C5CFF]">
          <Inbox size={20} strokeWidth={1.8} />
        </span>
        <p className="mt-3 text-sm font-semibold text-[#0F172A]">Nothing due today</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#8A94A6]">
          Tasks due today — or overdue — from your projects will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="rounded-2xl border border-[#E9EDF3] bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-16px_rgba(16,24,40,0.10)] sm:p-2">
      {tasks.slice(0, max).map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} busy={togglingId === task.id} />
      ))}
    </ul>
  );
}
