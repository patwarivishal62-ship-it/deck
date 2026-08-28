"use client";

import AppShell from "@/components/dashboard/AppShell";
import Greeting from "@/components/dashboard/Greeting";
import StatsGrid from "@/components/dashboard/StatsGrid";
import ProjectsSection from "@/components/dashboard/ProjectsSection";
import TasksSection from "@/components/dashboard/TasksSection";

export default function Home() {
  return (
    <AppShell framed>
      <Greeting />
      <StatsGrid />
      <ProjectsSection />
      <TasksSection />
    </AppShell>
  );
}
