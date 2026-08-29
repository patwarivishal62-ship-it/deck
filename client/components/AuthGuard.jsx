"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

// Gate for signed-in screens. Pages render their own app shell (sidebar +
// header), so no global bottom nav is mounted here anymore.
export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-2">
        <span className="font-mono text-xs uppercase tracking-widest text-text-faint">Loading…</span>
      </div>
    );
  }

  return children;
}
