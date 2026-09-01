"use client";

import Link from "next/link";

// items: [{ label, href? }] — the last item is treated as the current page
// (rendered as plain text, not a link) even if it has an href.
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 font-mono text-xs text-text-faint">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="text-[#232A36]">/</span>}
            {isLast || !item.href ? (
              <span className={isLast ? "text-text-soft" : ""} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="transition hover:text-[#7C5CFF]">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
