"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/constants";

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
      {/* Violet glows — restrained, premium */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 animate-float rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "#7C5CFF" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-8 h-44 w-44 animate-float_alt rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: "#4F7BFF" }}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-[#232A36] bg-[#161B22]/80 p-5 shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse_dot rounded-full bg-[#7C5CFF]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7A8599]">Live goal tracking</span>
        </div>
        <div className="flex flex-col gap-3.5">
          {DEMO.map((item, i) => {
            const category = CATEGORIES[item.key];
            return (
              <div key={item.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-[#7A8599]">{category.label}</span>
                  <span className="font-mono text-[11px] font-medium text-white">{filled ? item.pct : 0}%</span>
                </div>
                <div className="meter" style={{ background: "rgba(255,255,255,0.06)" }}>
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
