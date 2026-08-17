"use client";

export default function StatCard({ label, value, accent = "text" }) {
  const accents = {
    text: "text-white",
    signal: "text-[#7C5CFF]",
    good: "text-[#22D3A6]",
    faint: "text-[#7A8599]",
  };

  return (
    <div className="rounded-2xl border border-[#232A36] bg-[#161B22] px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7A8599]">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold tracking-tight ${accents[accent] || accents.text}`}>{value}</p>
    </div>
  );
}
