"use client";

// The white rounded card every panel on the platform sits in — identical
// border, background, and shadow to the Overview cards.
export default function Card({ children, className = "", as: Tag = "section", ...rest }) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.10)] ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// Card section header: bold small title on the left, optional action/notes on
// the right.
export function CardHeading({ title, id, right, sub }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-[15px] font-bold tracking-tight text-text">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-text-faint">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
