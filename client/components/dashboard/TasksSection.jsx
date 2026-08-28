"use client";

import { useState } from "react";
import Link from "next/link";
import TaskItem from "./TaskItem";
import { DASHBOARD_TASKS } from "@/lib/dashboardData";

export default function TasksSection() {
  const [tasks, setTasks] = useState(DASHBOARD_TASKS);

  function onToggle(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <section className="mt-6 pb-2">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[#172033]">Today’s Tasks</h2>
        <Link href="/projects" className="text-[12px] font-medium text-[#5146F5] transition-opacity duration-150 hover:opacity-80">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-[#F0F1F6]">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}
