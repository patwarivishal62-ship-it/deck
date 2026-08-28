"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Trash2, Check } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import Card from "@/components/app/Card";
import { ErrorBanner, PrimaryButton } from "@/components/app/UI";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/dashboard";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_STYLES = {
  deadline: { label: "Task deadline", color: "#DC3D43" },
  launch: { label: "Project due", color: "#4F7BFF" },
  milestone: { label: "Milestone", color: "#7C5CFF" },
  todo: { label: "To-do", color: "#12B76A" },
  note: { label: "Note", color: "#E8A23D" },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const inputClass =
  "h-10 w-full rounded-xl border border-[#E4E9F1] bg-white px-3.5 text-sm text-[#0F172A] outline-none transition placeholder:text-[#9AA5B5] hover:border-[#D6DEE9] focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10";

function CalendarView() {
  const now = new Date();
  const [events, setEvents] = useState(null); // null = loading
  const [error, setError] = useState("");

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  );

  // Quick-add a personal note/to-do for the selected day.
  const [quickText, setQuickText] = useState("");
  const [quickKind, setQuickKind] = useState("todo");
  const [quickDue, setQuickDue] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.listCalendarEvents();
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleQuickAdd(e) {
    e.preventDefault();
    if (!quickText.trim()) return;
    setQuickBusy(true);
    setError("");
    try {
      await api.createEntry({
        kind: quickKind,
        text: quickText.trim(),
        date: selectedDate,
        dueDate: quickKind === "todo" && quickDue ? quickDue : null,
      });
      setQuickText("");
      setQuickDue("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickBusy(false);
    }
  }

  async function togglePersonal(e) {
    setError("");
    try {
      await api.updateEntry(e.entryId, { done: !e.done });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePersonal(e) {
    setError("");
    try {
      await api.deleteEntry(e.entryId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const event of events || []) {
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
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
    setSelectedDate(dateKey(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  const selectedEvents = (eventsByDate[selectedDate] || []).sort((a, b) =>
    a.type.localeCompare(b.type)
  );
  const projectEvents = selectedEvents.filter((e) => !e.personal);
  const personalEvents = selectedEvents.filter((e) => e.personal);
  const today = todayISO();
  const loading = events === null;

  const monthEventCount = (events || []).filter((e) => {
    const [y, m] = e.date.split("-").map(Number);
    return y === year && m === month + 1;
  }).length;

  return (
    <AppShell>
      <PageHeading
        title="Calendar"
        subtitle="Deadlines, project due dates, and milestones across every project — plus your own notes and to-dos."
        actions={
          <button
            type="button"
            onClick={goToToday}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E9F1] bg-white px-4 py-2 text-[13px] font-semibold text-[#31405A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#D6DEE9] hover:bg-[#F8FAFD]"
          >
            <CalendarDays size={14} strokeWidth={2} />
            Today
          </button>
        }
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.entries(EVENT_STYLES).map(([type, s]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs font-medium text-[#8A94A6]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Month grid */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#F1F4F9] px-4 py-3">
            <h2 className="font-display text-[15px] font-bold tracking-tight text-[#0F172A]">
              {MONTH_NAMES[month]} {year}
              {!loading && (
                <span className="ml-2 text-xs font-medium text-[#8A94A6]">
                  {monthEventCount} event{monthEventCount !== 1 ? "s" : ""}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A94A6] transition hover:bg-[#F1F4F9] hover:text-[#0F172A]"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8A94A6] transition hover:bg-[#F1F4F9] hover:text-[#0F172A]"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[72px] animate-pulse border-b border-r border-[#F1F4F9] sm:min-h-[92px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              <div className="col-span-7 grid grid-cols-7 border-b border-[#F1F4F9] bg-[#F8FAFD]">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#8A94A6]"
                  >
                    <span className="sm:hidden">{d[0]}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>
              {grid.map((day, i) => {
                if (day === null) {
                  return <div key={i} className="min-h-[72px] border-b border-r border-[#F1F4F9] bg-[#FAFBFD] sm:min-h-[92px]" />;
                }
                const key = dateKey(year, month, day);
                const dayEvents = eventsByDate[key] || [];
                const isToday = key === today;
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    aria-label={`${key}${dayEvents.length ? `, ${dayEvents.length} events` : ""}`}
                    aria-pressed={isSelected}
                    className={`min-h-[72px] border-b border-r border-[#F1F4F9] p-1.5 text-left align-top transition duration-150 sm:min-h-[92px] sm:p-2 ${
                      isSelected ? "bg-[#F1EDFF]" : "bg-white hover:bg-[#F8FAFD]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-gradient-to-r from-[#7C5CFF] to-[#4F7BFF] text-white"
                          : isSelected
                            ? "bg-[#7C5CFF]/15 text-[#6D4FE0]"
                            : "text-[#5B6B7F]"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: EVENT_STYLES[e.type]?.color || "#8A94A6" }}
                        />
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="text-[9px] font-bold leading-none text-[#9AA5B5]">+{dayEvents.length - 4}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Selected day panel */}
        <div className="space-y-5">
          <Card>
            <div className="border-b border-[#F1F4F9] px-5 py-4">
              <h3 className="font-display text-[15px] font-bold tracking-tight text-[#0F172A]">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <p className="mt-0.5 text-xs text-[#8A94A6]">
                {selectedEvents.length} event{selectedEvents.length !== 1 ? "s" : ""} this day
              </p>
            </div>

            <div className="px-5 py-4">
              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-[#EEF1F6]" />
                  ))}
                </div>
              ) : projectEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E4E9F1] bg-[#FAFBFD] px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-[#0F172A]">Nothing scheduled</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#8A94A6]">
                    Project deadlines, milestones, and your own entries for this day will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {projectEvents.map((e) => (
                    <Link
                      key={e.id}
                      href={`/projects/${e.projectId}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#E9EDF3] bg-white px-3.5 py-3 transition duration-150 hover:border-[#7C5CFF]/25 hover:bg-[#F8FAFD]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: EVENT_STYLES[e.type]?.color || "#8A94A6" }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#0F172A]">{e.title}</p>
                          <p className="truncate text-xs text-[#8A94A6]">
                            {EVENT_STYLES[e.type]?.label || "Event"} · {e.projectName}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={15} strokeWidth={2} className="shrink-0 text-[#9AA5B5]" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Personal entries for the day */}
          <Card>
            <div className="flex items-center justify-between border-b border-[#F1F4F9] px-5 py-4">
              <h3 className="font-display text-[15px] font-bold tracking-tight text-[#0F172A]">Your notes &amp; to-dos</h3>
              <Link
                href="/personal"
                className="text-[13px] font-semibold text-[#6D4FE0] transition hover:text-[#5B3FD1]"
              >
                Open
              </Link>
            </div>

            <div className="px-5 py-4">
              {!loading && personalEvents.length === 0 ? (
                <p className="mb-3 text-xs text-[#8A94A6]">Nothing logged for this day yet.</p>
              ) : (
                personalEvents.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-2">
                    {personalEvents.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 rounded-xl border border-[#E9EDF3] bg-white px-3.5 py-2.5"
                      >
                        {e.type === "todo" ? (
                          <button
                            type="button"
                            onClick={() => togglePersonal(e)}
                            aria-label={e.done ? `Mark "${e.title}" as not done` : `Mark "${e.title}" as done`}
                            aria-pressed={e.done}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-150 ${
                              e.done
                                ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
                                : "border-[#C9D3E0] bg-white hover:border-[#7C5CFF] hover:bg-[#F7F5FF]"
                            }`}
                          >
                            {e.done && <Check size={12} strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: EVENT_STYLES.note.color }} />
                        )}
                        <p
                          className={`min-w-0 flex-1 truncate text-sm font-medium ${
                            e.type === "todo" && e.done ? "text-[#9AA5B5] line-through" : "text-[#0F172A]"
                          }`}
                        >
                          {e.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => deletePersonal(e)}
                          aria-label={`Delete "${e.title}"`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8A94A6] transition hover:bg-[#FDEEEF] hover:text-[#DC3D43]"
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

              <form onSubmit={handleQuickAdd} className="flex flex-col gap-2">
                <div className="flex gap-1.5">
                  {[
                    { value: "todo", label: "To-do" },
                    { value: "note", label: "Note" },
                  ].map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setQuickKind(k.value)}
                      aria-pressed={quickKind === k.value}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        quickKind === k.value
                          ? "border-[#7C5CFF]/30 bg-[#F1EDFF] text-[#6D4FE0]"
                          : "border-[#E4E9F1] bg-white text-[#5B6B7F] hover:border-[#D6DEE9]"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <input
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder={quickKind === "todo" ? "Add a to-do for this day…" : "Add a note for this day…"}
                  aria-label="Quick add entry"
                  className={inputClass}
                />
                {quickKind === "todo" && (
                  <label className="flex items-center gap-2 text-xs font-medium text-[#8A94A6]">
                    Due (optional)
                    <input
                      type="date"
                      value={quickDue}
                      onChange={(e) => setQuickDue(e.target.value)}
                      aria-label="Due date (optional)"
                      className={`${inputClass} h-9 w-[140px]`}
                    />
                  </label>
                )}
                <PrimaryButton type="submit" disabled={quickBusy || !quickText.trim()} className="self-start">
                  {quickBusy ? "Adding…" : "Add"}
                </PrimaryButton>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function CalendarPage() {
  return (
    <AuthGuard>
      <CalendarView />
    </AuthGuard>
  );
}
