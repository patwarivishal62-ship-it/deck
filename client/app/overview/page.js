"use client";

import AuthGuard from "@/components/AuthGuard";
import Greeting from "@/components/dashboard/Greeting";
import StatsGrid from "@/components/dashboard/StatsGrid";
import ProjectsSection from "@/components/dashboard/ProjectsSection";
import TasksSection from "@/components/dashboard/TasksSection";

function OverviewDashboard() {
  return (
    <>
      <Greeting />
      <StatsGrid />
      <ProjectsSection />
      <TasksSection />
    </>
  );
}

export default function OverviewPage() {
  return (
    <AuthGuard framed>
      <OverviewDashboard />
    </AuthGuard>
  );
}
