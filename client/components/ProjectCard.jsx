"use client";

import Link from "next/link";

export default function ProjectCard({ project, onDelete }) {
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

  return (
    <div className="group relative rounded-card border border-line bg-card p-5 transition hover:border-signal/40 hover:shadow-lg">
      <Link href={`/projects/${project.id}`} className="block">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse_dot rounded-full bg-signal" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
            {totalGoals} goal{totalGoals !== 1 ? "s" : ""} · {totalTasks} task{totalTasks !== 1 ? "s" : ""}
          </span>
        </div>
        <h3 className="font-display text-lg font-semibold text-text">{project.name}</h3>
        {project.description && (
          <p className="project-desc mt-1 text-sm text-text-soft">{project.description}</p>
        )}

        <div className="mt-4">
          <div className="meter">
            <div className="meter-fill bg-signal" style={{ width: `${avgProgress}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-text-faint">
            <span>{avgProgress}% avg goal progress</span>
            <span>{doneTasks}/{totalTasks} tasks done</span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDelete(project);
        }}
        aria-label="Delete project"
        className="absolute right-3 top-3 rounded-md p-1.5 text-text-faint opacity-0 transition hover:bg-signal-tint hover:text-signal-deep group-hover:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
        </svg>
      </button>
    </div>
  );
}
