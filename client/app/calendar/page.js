"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import TopBar from "@/components/TopBar";
import Breadcrumbs from "@/components/Breadcrumbs";
import { api } from "@/lib/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_STYLES = {
  deadline: { label: "Deadline", color: "#FF5D73", dot: "bg-[#FF5D73]" },
  launch: { label: "Launch date", color: "#4F7BFF", dot: "bg-[#4F7BFF]" },
  milestone: { label: "Milestone", color: "#7C5CFF", dot: "bg-[#7C5CFF]" },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function CalendarView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());

  useEffect(() => {
    api
      .listCalendarEvents()
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const event of events) {
      (map[event.date] ||= []).push(event);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  function goToMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function goToToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(todayKey());
  }

  const selectedEvents = (eventsByDate[selectedDate] || []).sort((a, b) =>
    a.type.localeCompare(b.type)
  );
  const today = todayKey();

  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:px-5 sm:py-8 md:pb-8">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Calendar" }]} />

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text">Calendar</h1>
            <p className="text-sm text-text-soft">Deadlines, launch dates, and milestones across every project.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {Object.entries(EVENT_STYLES).map(([type, s]) => (
              <span key={type} className="flex items-center gap-1.5 text-text-faint">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-[#2E1A1E] border border-[#FF5D73]/20 px-3 py-2 text-sm text-[#FF5D73]">{error}</p>}

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
              className="rounded-xl border border-line bg-card p-2 text-text-soft transition hover:border-[#7C5CFF]/30 hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 className="min-w-0 flex-1 text-center font-display text-sm font-semibold tracking-tight text-text sm:w-40 sm:flex-none sm:text-base">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Next month"
              className="rounded-xl border border-line bg-card p-2 text-text-soft transition hover:border-[#7C5CFF]/30 hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-text-soft transition hover:border-[#7C5CFF]/30 hover:text-text"
          >
            Today
          </button>
        </div>

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="grid grid-cols-7 border-b border-line bg-ink-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-1 py-2 text-center font-mono text-[10px] font-medium uppercase tracking-wide text-text-faint sm:px-2 sm:py-2.5 sm:text-[11px]">
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((day, i) => {
                  if (day === null) return <div key={i} className="min-h-[52px] border-b border-r border-line bg-paper/50 sm:min-h-[84px]" />;
                  const key = dateKey(year, month, day);
                  const dayEvents = eventsByDate[key] || [];
                  const isToday = key === today;
                  const isSelected = key === selectedDate;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(key)}
                      className={`min-h-[52px] border-b border-r border-line p-1 text-left align-top transition sm:min-h-[84px] sm:p-2 ${
                        isSelected ? "bg-[#7C5CFF]/15" : "bg-card hover:bg-card"
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-medium ${
                          isToday ? "bg-[#7C5CFF] text-white" : isSelected ? "bg-[#7C5CFF]/20 text-[#7C5CFF]" : "text-text-soft"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((e) => (
                          <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${EVENT_STYLES[e.type]?.dot || "bg-[#7A8599]"}`} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-line bg-card p-5">
              <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">{selectedDate}</h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-text-soft">Nothing scheduled this day.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={`/projects/${e.projectId}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-4 py-3 transition hover:border-[#7C5CFF]/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_STYLES[e.type]?.dot || "bg-[#7A8599]"}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{e.title}</p>
                          <p className="truncate text-xs text-text-faint">
                            {EVENT_STYLES[e.type]?.label} · {e.projectName}
                          </p>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-text-faint">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <AuthGuard>
      <CalendarView />
    </AuthGuard>
  );
}
