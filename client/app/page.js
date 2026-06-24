"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/projects" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <span className="font-mono text-xs uppercase tracking-widest text-text-faint">Loading…</span>
    </div>
  );
}
