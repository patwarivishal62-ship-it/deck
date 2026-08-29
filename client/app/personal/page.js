"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Trash2, StickyNote, ListTodo, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/app/AppShell";
import PageHeading from "@/components/app/PageHeading";
import { SegmentedControl } from "@/components/app/Pills";
import { EmptyState, ErrorBanner, PrimaryButton } from "@/components/app/UI";
import { Chip } from "@/components/app/Pills";
import SummaryCard from "@/components/dashboard/SummaryCard";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/dashboard";

const KINDS = [
  { value: "todo", label: "To-do" },
  { value: "note", label: "Note" },
];

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateLabel(iso) {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  if (iso === addDaysISO(today, 1)) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

const inputClass =
  "h-10 w-full rounded-xl border border-line bg-card px-3.5 text-sm text-text outline-none transition placeholder:text-text-faint hover:border-line focus:border-[#7C5CFF]/50 focus:ring-4 focus:ring-[#7C5CFF]/10";

function TasksView() {
  const [entries, setEntries] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | todo | note
  const [search, setSearch] = useState("");

  // Add form
  const [kind, setKind] = useState("todo");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editDue, setEditDue] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.listEntries();
      setEntries(data.entries);
    } catch (err) {
      setError(err.message);
      setEntries((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Default the add-form date to today once, after mount (avoids a
  // server/client hydration mismatch on the date input).
  useEffect(() => {
    setDate((d) => d || todayISO());
  }, []);

  // Support /personal?date=YYYY-MM-DD (linked from the calendar) to pre-fill
  // the add form's date.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
  }, []);

  const today = todayISO();

  const stats = useMemo(() => {
    const list = entries || [];
    const todos = list.filter((e) => e.kind === "todo");
    return {
      open: todos.filter((e) => !e.done).length,
      done: todos.filter((e) => e.done).length,
      overdue: todos.filter((e) => !e.done && e.dueDate && e.dueDate < today).length,
      notes: list.filter((e) => e.kind === "note").length,
    };
  }, [entries, today]);

  const q = search.trim().toLowerCase();

  const groups = useMemo(() => {
    const list = (entries || []).filter((e) => (filter === "all" ? true : e.kind === filter));
    const filtered = q
      ? list.filter((e) => e.text.toLowerCase().includes(q))
      : list;
    const map = {};
    for (const e of filtered) {
      (map[e.date] ||= []).push(e);
    }
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((d) => ({
        date: d,
        items: map[d].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "todo" ? -1 : 1)),
      }));
  }, [entries, filter, q]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.createEntry({
        kind,
        text: text.trim(),
        date: date || today,
        dueDate: kind === "todo" && dueDate ? dueDate : null,
      });
      setText("");
      setDueDate("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(entry) {
    setError("");
    const next = { ...entry, done: !entry.done };
    setEntries((prev) => (prev || []).map((e) => (e.id === entry.id ? next : e)));
    try {
      await api.updateEntry(entry.id, { done: !entry.done });
    } catch (err) {
      setError(err.message);
      setEntries((prev) => (prev || []).map((e) => (e.id === entry.id ? entry : e)));
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditText(entry.text);
    setEditDue(entry.dueDate || "");
  }

  async function saveEdit(entry) {
    if (!editText.trim()) return;
    setError("");
    try {
      await api.updateEntry(entry.id, {
        text: editText.trim(),
        ...(entry.kind === "todo" ? { dueDate: editDue || null } : {}),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeEntry(entry) {
    setError("");
    setEntries((prev) => (prev || []).filter((e) => e.id !== entry.id));
    try {
      await api.deleteEntry(entry.id);
    } catch (err) {
      setError(err.message);
      load();
    }
  }

  const loading = entries === null;
  const overdue = (e) => e.kind === "todo" && !e.done && e.dueDate && e.dueDate < today;

  return (
    <AppShell search={search} onSearchChange={setSearch} searchPlaceholder="Search tasks & notes…">
      <PageHeading
        title="Tasks"
        subtitle="Your private to-dos and notes — only you can see these. Everything is dated, so it doubles as a work journal."
      />

      <ErrorBanner message={error} onRetry={load} />

      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Open to-dos"
          value={loading ? "—" : stats.open}
          info={stats.open > 0 ? "waiting to be checked off" : "all clear"}
          infoTone={stats.open > 0 ? "accent" : "positive"}
          icon={ListTodo}
          iconBg="#F1EDFF"
          iconColor="#7C5CFF"
        />
        <SummaryCard
          label="Completed"
          value={loading ? "—" : stats.done}
          info={stats.notes > 0 ? `plus ${stats.notes} note${stats.notes !== 1 ? "s" : ""} logged` : "keep going"}
          infoTone="positive"
          icon={CheckCircle2}
          iconBg="#E7F6EF"
          iconColor="#12B76A"
        />
        <SummaryCard
          label="Overdue"
          value={loading ? "—" : stats.overdue}
          info={stats.overdue > 0 ? "past their due date" : "nothing overdue"}
          infoTone={stats.overdue > 0 ? "danger" : "positive"}
          icon={AlertTriangle}
          iconBg={stats.overdue > 0 ? "#FDEEEF" : "#E7F6EF"}
          iconColor={stats.overdue > 0 ? "#DC3D43" : "#12B76A"}
        />
      </div>

      {/* Quick add */}
      <form
        onSubmit={handleAdd}
        className="mt-6 rounded-2xl border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.10)] sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="w-full sm:max-w-[220px]">
            <SegmentedControl ariaLabel="Entry type" value={kind} onChange={setKind} options={KINDS} />
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "todo" ? "Add a to-do… e.g. Draft launch announcement" : "Write a note… e.g. Client prefers teal"}
            aria-label={kind === "todo" ? "New to-do" : "New note"}
            className={inputClass}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 text-xs font-medium text-text-faint">
              On day
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Day for this entry"
                className={`${inputClass} h-9 w-[150px]`}
              />
            </label>
            {kind === "todo" && (
              <label className="flex items-center gap-2 text-xs font-medium text-text-faint">
                Due
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="Due date (optional)"
                  className={`${inputClass} h-9 w-[150px]`}
                />
              </label>
            )}
          </div>
          <PrimaryButton type="submit" disabled={busy || !text.trim()} className="self-end sm:self-auto">
            <Plus size={15} strokeWidth={2.2} />
            {busy ? "Adding…" : "Add"}
          </PrimaryButton>
        </div>
      </form>

      {/* Filters */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Filter entries"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: (entries || []).length },
            { value: "todo", label: "To-dos", count: (entries || []).filter((e) => e.kind === "todo").length },
            { value: "note", label: "Notes", count: (entries || []).filter((e) => e.kind === "note").length },
          ]}
        />
      </div>

      {/* Groups */}
      <div className="mt-5 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState icon={StickyNote} title={q || filter !== "all" ? "Nothing matches" : "Nothing here yet"}>
            {q || filter !== "all" ? (
              <p>Try a different search or filter.</p>
            ) : (
              <p>Add a to-do or note above — it will show up on its day, here and on the calendar.</p>
            )}
          </EmptyState>
        ) : (
          groups.map((group) => (
            <section key={group.date} aria-label={group.date}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <h2 className="text-[13px] font-bold tracking-tight text-text">{dateLabel(group.date)}</h2>
                <span className="font-mono text-[11px] text-text-faint">{group.date}</span>
                <span className="h-px flex-1 bg-paper-2" />
              </div>
              <ul className="overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_24px_-16px_rgba(16,24,40,0.10)] sm:p-2">
                {group.items.map((e) => {
                  const isOverdue = overdue(e);
                  return (
                    <li
                      key={e.id}
                      className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition duration-150 hover:border-line hover:bg-paper"
                    >
                      {e.kind === "todo" ? (
                        <button
                          type="button"
                          onClick={() => toggleDone(e)}
                          disabled={editingId === e.id}
                          aria-label={e.done ? `Mark "${e.text}" as not done` : `Mark "${e.text}" as done`}
                          aria-pressed={e.done}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-150 ${
                            e.done
                              ? "border-[#7C5CFF] bg-[#7C5CFF] text-white"
                              : "border-line bg-card hover:border-[#7C5CFF] hover:bg-signal-tint"
                          }`}
                        >
                          {e.done && <Check size={12} strokeWidth={3} />}
                        </button>
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                          <span className="h-2 w-2 rounded-full bg-[#E8A23D]" />
                        </span>
                      )}

                      {editingId === e.id ? (
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            autoFocus
                            value={editText}
                            onChange={(ev) => setEditText(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") saveEdit(e);
                              if (ev.key === "Escape") setEditingId(null);
                            }}
                            aria-label="Edit entry"
                            className={inputClass}
                          />
                          {e.kind === "todo" && (
                            <input
                              type="date"
                              value={editDue}
                              onChange={(ev) => setEditDue(ev.target.value)}
                              aria-label="Edit due date"
                              className={`${inputClass} sm:w-[150px]`}
                            />
                          )}
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => saveEdit(e)}
                              className="rounded-full bg-[#7C5CFF] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6A4AF0]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-text-soft transition hover:bg-paper"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-medium ${
                                e.kind === "todo" && e.done ? "text-text-faint line-through" : "text-text"
                              }`}
                            >
                              {e.text}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-faint">
                              {e.kind === "todo" ? "To-do" : "Note"}
                              {e.dueDate && (
                                <span className={isOverdue ? "font-semibold text-error-text" : ""}>
                                  · due {e.dueDate}
                                  {isOverdue ? " (overdue)" : ""}
                                </span>
                              )}
                              {e.kind === "todo" && e.done && e.completedAt && (
                                <span>· done {new Date(e.completedAt).toLocaleDateString()}</span>
                              )}
                            </p>
                          </div>

                          {e.kind === "todo" && !e.done && isOverdue && <Chip tone="danger">Overdue</Chip>}
                          {e.kind === "todo" && e.done && <Chip tone="positive">Done</Chip>}

                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEdit(e)}
                              aria-label={`Edit "${e.text}"`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-faint transition hover:bg-paper-2 hover:text-text"
                            >
                              <Pencil size={15} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEntry(e)}
                              aria-label={`Delete "${e.text}"`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-faint transition hover:bg-error-tint hover:text-error-text"
                            >
                              <Trash2 size={15} strokeWidth={1.8} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}

export default function PersonalPage() {
  return (
    <AuthGuard>
      <TasksView />
    </AuthGuard>
  );
}
