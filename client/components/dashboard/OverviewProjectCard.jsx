"use client";

import Link from "next/link";
import { Rocket, Megaphone, Target, Search, FileText, Mail } from "lucide-react";

// One icon per goal category, so each project tile reflects what it measures.
const CATEGORY_ICONS = {
  social: Megaphone,
  ads: Target,
  seo: Search,
  content: FileText,
  email: Mail,
};

const TONES = {
  good: "bg-[#E8F8EE] text-[#22A06B]",
  signal: "bg-[#EEF0FF] text-[#5146F5]",
  faint: "bg-[#F1F2F8] text-[#6B7390]",
};

export default function OverviewProjectCard({ project }) {
  const Icon = CATEGORY_ICONS[project.category] || Rocket;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group rounded-[14px] border border-[#E8EAF0] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(23,32,51,0.04)] transition-shadow duration-150 hover:shadow-[0_8px_20px_rgba(23,32,51,0.06)]"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: project.color }}
        >
          <Icon size={16} className="text-white" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[13.5px] font-semibold text-[#172033] group-hover:text-[#5146F5]">
              {project.title}
            </h3>
            <span className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold ${TONES[project.tone] || TONES.faint}`}>
              {project.statusLabel}
            </span>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#EEF0F5]">
              <div className="h-full rounded-full bg-[#5146F5]" style={{ width: `${project.progress}%` }} />
            </div>
            <span className="w-8 text-right text-[11px] font-medium text-[#7B8498]">{project.progress}%</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-[#7B8498]">
            <span className="truncate">
              {project.taskCount} Tasks
              {project.workspaceName ? ` · ${project.workspaceName}` : ""}
            </span>
            <span className="shrink-0">Due: {project.dueLabel}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
