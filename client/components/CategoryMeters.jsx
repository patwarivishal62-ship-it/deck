"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";

// The five real goal categories from the product, each shown as a live meter
// filling toward a representative "healthy" progress level. This is the
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
    <div className="relative">
      {/* Ambient glow, blurred and offset behind the card — the one place this
          page spends visual boldness, matching the product's own category colors. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 animate-float rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: CATEGORIES.social.color }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 animate-float_alt rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: CATEGORIES.seo.color }}
      />

      <div className="relative w-full max-w-md rounded-card border border-ink-line bg-ink-2/70 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
    </div>
  );
}
