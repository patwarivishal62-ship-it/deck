"use client";

// Page title block used across the app — same typography everywhere:
// large bold heading, muted supporting line, optional actions on the right.
export default function PageHeading({ title, subtitle, actions, as = "h1" }) {
  const Heading = as;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Heading className="font-display text-[22px] font-bold tracking-tight text-[#0F172A] sm:text-2xl">
          {title}
        </Heading>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-[#5B6B7F]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
