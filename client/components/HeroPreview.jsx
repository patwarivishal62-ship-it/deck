"use client";

export default function HeroPreview() {
  return (
    <div className="relative w-full max-w-[440px]">
      {/* Subtle glow behind */}
      <div className="pointer-events-none absolute -top-8 -left-4 h-32 w-32 rounded-full bg-signal/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-4 h-32 w-32 rounded-full bg-royal/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-line bg-card shadow-card">
        {/* Header */}
        <div className="border-b border-line bg-ink-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal animate-pulse_dot" />
              <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Q3 Launch — Acme</span>
              <span className="rounded-full bg-[#E8A23D] px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">High</span>
            </div>
            <span className="font-mono text-[10px] text-text-faint">Due Sep 18</span>
          </div>
          <h3 className="mt-2 font-display text-sm font-semibold text-text">Q3 Launch — Acme</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-soft">Instagram + Paid Ads + Content — one board, zero slips.</p>
          <div className="mt-2.5 flex gap-1.5">
            <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-text-soft">#Launch</span>
            <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] text-text-soft">#Acme</span>
          </div>
        </div>

        {/* Goals */}
        <div className="grid grid-cols-3 gap-2 border-b border-line bg-paper px-3 py-3">
          {[
            { label: "Reels", pct: 72, color: "#7C5CFF", meta: "Social" },
            { label: "Leads", pct: 54, color: "#4F7BFF", meta: "Ads" },
            { label: "Posts", pct: 88, color: "#22D3A6", meta: "Content" },
          ].map((g) => (
            <div key={g.label} className="rounded-xl border border-line bg-card px-2.5 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wide text-text-faint">{g.meta}</p>
              <p className="mt-1 font-display text-xs font-semibold text-text">{g.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-2">
                <div className="h-full rounded-full" style={{ width: `${g.pct}%`, backgroundColor: g.color }} />
              </div>
              <p className="mt-1 font-mono text-[10px] text-text-faint">{g.pct}%</p>
            </div>
          ))}
        </div>

        {/* Tasks */}
        <div className="px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-faint">Today</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              { title: "Shoot reel #1", status: "In progress", dot: "bg-signal", due: "Today" },
              { title: "Draft ad copy", status: "To do", dot: "bg-ink-2 border border-line", due: "Tomorrow" },
              { title: "Publish blog post", status: "Done", dot: "bg-good" },
            ].map((t) => (
              <div key={t.title} className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full ${t.dot} ${t.status === "In progress" ? "animate-pulse" : ""}`} />
                  <span className={`truncate text-xs ${t.status === "Done" ? "line-through text-text-faint" : "text-text"}`}>{t.title}</span>
                </div>
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium ${t.status === "Done" ? "bg-good/15 text-good" : t.status === "In progress" ? "bg-signal/15 text-signal" : "bg-ink-2 text-text-faint"}`}>{t.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-text-faint">
            <span>3 tasks • 1 done</span>
            <span className="text-signal">View board →</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-text-faint">Real project board — not a demo. Your data, same view.</p>
    </div>
  );
}
