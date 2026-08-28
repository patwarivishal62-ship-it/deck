"use client";

import AppShell from "@/components/dashboard/AppShell";
import OverviewContent from "@/components/dashboard/OverviewContent";

// Home page: the real overview, powered by the signed-in user's actual
// projects. Signed-out visitors are redirected to /login (OverviewContent).
export default function Home() {
  return (
    <AppShell framed>
      <OverviewContent />
    </AppShell>
  );
}
