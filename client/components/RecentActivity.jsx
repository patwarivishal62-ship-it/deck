"use client";

function buildActivity(projects) {
  const events = [];

  projects.forEach((project) => {
    events.push({
      id: `project-created-${project.id}`,
      at: project.createdAt,
      text: `Created project "${project.name}"`,
    });

    (project.tasks || []).forEach((task) => {
      if (task.status === "done" && task.completedAt) {
        events.push({
          id: `task-done-${task.id}`,
          at: task.completedAt,
          text: `Completed "${task.title}" in ${project.name}`,
        });
      }
    });
  });

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function RecentActivity({ projects }) {
  const events = buildActivity(projects);

  return (
    <div className="rounded-card border border-line bg-card p-5">
      <h2 className="font-display text-sm font-semibold text-text">Recent activity</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-text-soft">
          Nothing yet — create a project and complete a task to see activity here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text-soft">{event.text}</span>
              <span className="whitespace-nowrap font-mono text-[11px] text-text-faint">
                {timeAgo(event.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
