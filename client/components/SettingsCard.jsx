"use client";

export default function SettingsCard({ title, description, children, danger = false }) {
  return (
    <section
      className={`rounded-card border bg-card p-5 ${
        danger ? "border-signal-tint" : "border-line"
      }`}
    >
      <h2 className={`font-display text-base font-semibold ${danger ? "text-signal-deep" : "text-text"}`}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-text-soft">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
