"use client";

export default function StatCard({ label, value, accent = "text" }) {
  const accents = {
    text: "text-text",
    signal: "text-signal-deep",
    good: "text-good",
    faint: "text-text-faint",
  };

  return (
    <div className="rounded-card border border-line bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${accents[accent] || accents.text}`}>{value}</p>
    </div>
  );
}
