"use client";

export default function SettingsCard({ title, description, children, danger = false }) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-card ${danger ? "border-[#FF5D73]/20 bg-card" : "border-line bg-card"}`}
    >
      <h2 className={`font-display text-base font-semibold tracking-tight ${danger ? "text-[#FF5D73]" : "text-text"}`}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-text-soft">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
