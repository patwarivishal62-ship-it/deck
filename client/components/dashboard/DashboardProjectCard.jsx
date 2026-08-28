"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ellipsis, Folder, Megaphone, Target, TrendingUp, PenLine, Mail, ExternalLink, Archive, Trash2 } from "lucide-react";
import { getProjectStatus } from "@/lib/projectStatus";
import { CATEGORIES } from "@/lib/constants";
import { projectCategoryKey, projectProgress, formatDueDate, isOverdueDate } from "@/lib/dashboard";

const CATEGORY_ICONS = {
  social: Megaphone,
  ads: Target,
  seo: TrendingUp,
  content: PenLine,
  email: Mail,
  other: Folder,
};

// Status pill colors — small rounded pill per the reference. Shared with the
// platform-wide StatusPill in components/app/UI.jsx.
const STATUS_PILLS = {
  completed: { label: "Completed", bg: "#E7F6EF", color: "#0E9F6E", dot: "#12B76A" },
  in_progress: { label: "In progress", bg: "#F1EDFF", color: "#6D4FE0", dot: "#7C5CFF" },
  pending: { label: "Pending", bg: "#F1F4F9", color: "#5B6B7F", dot: "#8A94A6" },
};

const ARCHIVED_PILL = { label: "Archived", bg: "#F1F4F9", color: "#8A94A6", dot: "#C9D3E0" };

export default function DashboardProjectCard({ project, onArchiveToggle, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const goals = project.goals || [];
  const tasks = project.tasks || [];
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progress = projectProgress(project);
  const status = getProjectStatus(project);
  const pill = STATUS_PILLS[status] || STATUS_PILLS.pending;

  const categoryKey = projectCategoryKey(project);
  const CategoryIcon = CATEGORY_ICONS[categoryKey] || Folder;
  const categoryColor = categoryKey ? CATEGORIES[categoryKey].color : null;
  const iconBg = categoryColor ? `${categoryColor}14` : "#F1F4F9";
  const iconColor = categoryColor || "#8A94A6";

  const overdue = !project.archived && isOverdueDate(project.dueDate);

  return (
    <article className="relative rounded-2xl border border-[#E9EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-16px_rgba(16,24,40,0.10)] transition duration-200 hover:border-[#7C5CFF]/25 hover:shadow-[0_2px_4px_rgba(16,24,40,0.04),0_16px_32px_-16px_rgba(124,92,255,0.18)] sm:p-5">
      <div className="flex items-start gap-3.5">
        {/* Icon container */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          <CategoryIcon size={18} strokeWidth={1.8} />
        </span>

        {/* Title + status */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pr-6">
            <Link
              href={`/projects/${project.id}`}
              className="truncate font-display text-[15px] font-semibold tracking-tight text-[#0F172A] transition hover:text-[#6D4FE0]"
            >
              {project.name}
            </Link>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: pill.bg, color: pill.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
              {pill.label}
            </span>
            {project.archived && (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: ARCHIVED_PILL.bg, color: ARCHIVED_PILL.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ARCHIVED_PILL.dot }} />
                {ARCHIVED_PILL.label}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-1 truncate text-xs text-[#8A94A6]">{project.description}</p>
          )}
        </div>

        {/* More options */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Options for ${project.name}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A94A6] transition hover:bg-[#F1F4F9] hover:text-[#0F172A]"
          >
            <Ellipsis size={18} strokeWidth={1.8} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-44 overflow-hidden rounded-xl border border-[#E9EDF3] bg-white py-1 shadow-[0_16px_40px_-12px_rgba(16,24,40,0.25)]">
              <Link
                href={`/projects/${project.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-[#31405A] transition hover:bg-[#F6F8FB]"
              >
                <ExternalLink size={15} strokeWidth={1.8} className="text-[#8A94A6]" />
                Open project
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onArchiveToggle?.(project);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#31405A] transition hover:bg-[#F6F8FB]"
              >
                <Archive size={15} strokeWidth={1.8} className="text-[#8A94A6]" />
                Archive
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete?.(project);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[#DC3D43] transition hover:bg-[#FDF0F0]"
              >
                <Trash2 size={15} strokeWidth={1.8} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F6]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${project.name} progress`}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs font-bold text-[#0F172A]">{progress}%</span>
      </div>

      {/* Metadata + due date */}
      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-[#8A94A6]">
          {goals.length} goal{goals.length !== 1 ? "s" : ""} · {tasks.length} task{tasks.length !== 1 ? "s" : ""} · {doneTasks}/{tasks.length} done
        </span>
        {project.dueDate ? (
          <span className={`shrink-0 font-medium ${overdue ? "text-[#DC3D43]" : "text-[#5B6B7F]"}`}>
            {overdue ? "Overdue · " : "Due "}
            {formatDueDate(project.dueDate)}
          </span>
        ) : (
          <span className="shrink-0 text-[#9AA5B5]">No due date</span>
        )}
      </div>
    </article>
  );
}
