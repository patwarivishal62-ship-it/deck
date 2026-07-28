"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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

export default function ActivityTimeline({ projectId }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listActivity(projectId)
      .then((data) => setActivity(data.activity))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-signal-deep">{error}</p>;
  }
  if (activity.length === 0) {
    return <p className="text-sm text-text-soft">No activity yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {activity.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-soft">{entry.message}</span>
          <span className="whitespace-nowrap font-mono text-[11px] text-text-faint">
            {timeAgo(entry.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
