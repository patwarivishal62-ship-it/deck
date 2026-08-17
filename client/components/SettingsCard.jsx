"use client";

export default function SettingsCard({ title, description, children, danger = false }) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-card ${danger ? "border-[#FF5D73]/20 bg-[#161B22]" : "border-[#232A36] bg-[#161B22]"}`}
    >
      <h2 className={`font-display text-base font-semibold tracking-tight ${danger ? "text-[#FF5D73]" : "text-white"}`}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-[#B8C0CC]">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
