"use client";

export default function StatCard({ label, value, accent = "text" }) {
  const accents = {
    text: "text-text",
    signal: "text-[#7C5CFF]",
    good: "text-[#22D3A6]",
    faint: "text-text-faint",
  };

  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold tracking-tight ${accents[accent] || accents.text}`}>{value}</p>
    </div>
  );
}
