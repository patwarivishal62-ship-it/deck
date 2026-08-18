"use client";

import Link from "next/link";
import { PRIORITIES } from "@/lib/constants";

function formatDueDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(iso) {
  if (!iso) return false;
  const due = new Date(`${iso}T23:59:59`);
  return due < new Date();
}

export default function ProjectCard({ project, onDelete, onArchiveToggle, showWorkspaceLabel }) {
  const totalGoals = project.goals.length;
  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === "done").length;
  const avgProgress =
    totalGoals > 0
      ? Math.round(
          project.goals.reduce(
            (sum, g) => sum + (g.targetValue > 0 ? Math.min(1, g.currentValue / g.targetValue) : 0),
            0
          ) / totalGoals * 100
        )
      : 0;

  const priority = PRIORITIES[project.priority] || PRIORITIES.medium;
  const overdue = !project.archived && isOverdue(project.dueDate);

  return (
    <div
      className={`group relative rounded-2xl border bg-card p-5 transition-all duration-300 hover:border-[#7C5CFF]/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 ${
        project.archived ? "border-line opacity-60" : "border-line"
      }`}
    >
      <Link href={`/projects/${project.id}`} className="block">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse_dot rounded-full bg-[#7C5CFF]" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
            {totalGoals} goal{totalGoals !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-text"
            style={{ backgroundColor: priority.color }}
          >
            {priority.label}
          </span>
          {project.archived && (
            <span className="rounded-full bg-ink-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
              Archived
            </span>
          )}
          {showWorkspaceLabel && project.workspaceName && (
            <span className="rounded-full bg-ink-2 border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-soft">
              {project.workspaceName}
            </span>
          )}
        </div>
        <h3 className="font-display text-[17px] font-semibold tracking-tight text-text">{project.name}</h3>
        {project.description && (
          <p className="project-desc mt-1.5 text-sm leading-relaxed text-text-soft">{project.description}</p>
        )}

        {project.tags && project.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-text-soft"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {project.dueDate && (
          <p className={`mt-3 text-xs ${overdue ? "font-medium text-[#FF5D73]" : "text-text-faint"}`}>
            {overdue ? "Overdue: " : "Due "}
            {formatDueDate(project.dueDate)}
          </p>
        )}

        <div className="mt-4">
          <div className="meter">
            <div className="meter-fill bg-[#7C5CFF]" style={{ width: `${avgProgress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-text-faint">
            <span>{avgProgress}% avg goal progress</span>
            <span>
              {doneTasks}/{totalTasks} done
            </span>
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onArchiveToggle(project);
          }}
          aria-label={project.archived ? "Unarchive project" : "Archive project"}
          title={project.archived ? "Unarchive" : "Archive"}
          className="rounded-lg p-1.5 text-text-faint transition hover:bg-ink-2 hover:text-text"
        >
          {project.archived ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="8" width="18" height="13" rx="1.5" />
              <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M9 13h6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="5" rx="1.5" />
              <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {(project.workspaceRole === "admin" || project.workspaceRole === "owner" || !project.workspaceRole) && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete(project);
            }}
            aria-label="Delete project"
            className="rounded-lg p-1.5 text-text-faint transition hover:bg-[#2E1A1E] hover:text-[#FF5D73]"
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
