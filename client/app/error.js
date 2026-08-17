"use client";

import { useEffect } from "react";

// Route-level error boundary. Without this, any client-side render error shows
// Next.js's bare "Application error: a client-side exception has occurred"
// screen with no way out. This at least keeps the user oriented and offers a
// retry that re-renders the segment instead of forcing a hard reload.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Deck route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
        <p className="font-display text-base font-semibold text-text">Something went wrong</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-soft">
          This page hit an unexpected error. Try again — if it keeps happening, reload the page.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-[#7C5CFF] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#6A44FF]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-line bg-card px-5 py-2 text-sm font-medium text-text transition hover:border-[#7C5CFF]/40"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
