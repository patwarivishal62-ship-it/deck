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
  deadline: { label: "Deadline", color: "#ff5a38", dot: "bg-signal" },
  launch: { label: "Launch date", color: "#1e88e5", dot: "bg-[#1e88e5]" },
  milestone: { label: "Milestone", color: "#7c5cfc", dot: "bg-[#7c5cfc]" },
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
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

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
      <main className="mx-auto max-w-5xl px-5 py-8">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Calendar" }]} />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text">Calendar</h1>
            <p className="text-sm text-text-soft">Deadlines, launch dates, and milestones across every project.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(EVENT_STYLES).map(([type, s]) => (
              <span key={type} className="flex items-center gap-1.5 text-text-faint">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-signal-deep">{error}</p>}

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              aria-label="Previous month"
              className="rounded-md border border-line bg-card p-1.5 text-text-soft hover:border-signal/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 className="w-40 text-center font-display text-base font-semibold text-text">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Next month"
              className="rounded-md border border-line bg-card p-1.5 text-text-soft hover:border-signal/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-line bg-card px-2.5 py-1 text-xs text-text-soft hover:border-signal/40"
          >
            Today
          </button>
        </div>

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-card border border-line bg-card">
              <div className="grid grid-cols-7 border-b border-line bg-paper">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2 text-center font-mono text-[11px] text-text-faint">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((day, i) => {
                  if (day === null) return <div key={i} className="min-h-[84px] border-b border-r border-line bg-paper/40" />;
                  const key = dateKey(year, month, day);
                  const dayEvents = eventsByDate[key] || [];
                  const isToday = key === today;
                  const isSelected = key === selectedDate;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDate(key)}
                      className={`min-h-[84px] border-b border-r border-line p-1.5 text-left align-top transition hover:bg-paper ${
                        isSelected ? "bg-signal-tint/40" : "bg-card"
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-xs ${
                          isToday ? "bg-signal text-white" : "text-text-soft"
                        }`}
                      >
                        {day}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((e) => (
                          <span
                            key={e.id}
                            className={`h-1.5 w-1.5 rounded-full ${EVENT_STYLES[e.type]?.dot || "bg-text-faint"}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-card border border-line bg-card p-4">
              <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-text-faint">
                {selectedDate}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-text-soft">Nothing scheduled this day.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={`/projects/${e.projectId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2 transition hover:border-signal/40"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${EVENT_STYLES[e.type]?.dot || "bg-text-faint"}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text">{e.title}</p>
                          <p className="truncate text-xs text-text-faint">
                            {EVENT_STYLES[e.type]?.label} · {e.projectName}
                          </p>
                        </div>
                      </div>
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
