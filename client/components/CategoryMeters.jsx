"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";

// The five real goal categories from the product, each shown as a live meter
// filling toward a representative "healthy" progress level — this is the
// app's own visual language (meter + category colors + pulse dot), not a
// generic decorative graphic.
const DEMO = [
  { key: "social", pct: 72 },
  { key: "ads", pct: 54 },
  { key: "seo", pct: 88 },
  { key: "content", pct: 40 },
  { key: "email", pct: 63 },
];

export default function CategoryMeters() {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilled(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="w-full max-w-md rounded-card border border-ink-line bg-ink-2/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse_dot rounded-full bg-signal" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
          Live goal tracking
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {DEMO.map((item, i) => {
          const category = CATEGORIES[item.key];
          return (
            <div key={item.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wide text-text-faint">
                  {category.label}
                </span>
                <span className="font-mono text-[11px] text-white/70">
                  {filled ? item.pct : 0}%
                </span>
              </div>
              <div className="meter" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="meter-fill"
                  style={{
                    width: `${filled ? item.pct : 0}%`,
                    backgroundColor: category.color,
                    transitionDelay: `${i * 120}ms`,
                    transitionDuration: "900ms",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
