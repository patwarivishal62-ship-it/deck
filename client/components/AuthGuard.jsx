"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AppShell from "./dashboard/AppShell";

export default function AuthGuard({ children, framed = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FC]">
        <span className="text-xs uppercase tracking-widest text-[#7B8498]">Loading…</span>
      </div>
    );
  }

  return <AppShell framed={framed}>{children}</AppShell>;
}
