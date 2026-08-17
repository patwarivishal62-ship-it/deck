"use client";

export default function ErrorFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6 text-center">
      <div className="max-w-sm rounded-2xl border border-line bg-card p-6">
        <p className="font-semibold text-text">Something went wrong</p>
        <p className="mt-1 text-sm text-text-soft">Please refresh the page. If it persists, contact support.</p>
        <button onClick={() => window.location.reload()} className="mt-3 rounded-full bg-signal px-4 py-1.5 text-sm font-medium text-white">
          Refresh
        </button>
      </div>
    </div>
  );
}
