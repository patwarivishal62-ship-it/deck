"use client";

import { Check } from "lucide-react";

export default function TaskItem({ task, onToggle }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <button type="button" onClick={() => onToggle(task.id)} className="flex min-w-0 items-center gap-2.5 text-left">
        <span
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
            task.done ? "border-[#5146F5] bg-[#5146F5]" : "border-[#B8BEE0] bg-white"
          }`}
        >
          {task.done && <Check size={11} strokeWidth={3} className="text-white" />}
        </span>
        <span className={`truncate text-[13px] ${task.done ? "text-[#172033]" : "text-[#172033]"}`}>{task.title}</span>
      </button>
      <span className="shrink-0 rounded-full bg-[#F1F2F8] px-2 py-[3px] text-[10px] font-medium text-[#6B7390]">{task.pill}</span>
    </li>
  );
}
