"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Button, TextInput } from "@/components/FormControls";
import { api } from "@/lib/api";

const KINDS = [
  { value: "todo", label: "To-do" },
  { value: "note", label: "Note" },
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function localISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayISODate() {
  return localISODate(new Date());
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localISODate(date);
}

function dateLabel(iso) {
  if (iso === todayISODate()) return "Today";
  if (iso === addDaysISO(todayISODate(), -1)) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function PersonalView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // all | todo | note

  // Add form state
  const [kind, setKind] = useState("todo");
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editDue, setEditDue] = useState("");

  const load = useCallback(() => {
    api
      .listEntries()
      .then((data) => setEntries(data.entries))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Support /personal?date=YYYY-MM-DD (e.g. linked from the calendar) to
  // pre-fill the add form's date.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
  }, []);

  const groups = useMemo(() => {
    const filtered = entries.filter((e) => (filter === "all" ? true : e.kind === filter));
    const map = {};
    for (const e of filtered) {
      (map[e.date] ||= []).push(e);
    }
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }));
  }, [entries, filter]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createEntry({
        kind,
        text: text.trim(),
        date,
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
    try {
      await api.updateEntry(entry.id, { done: !entry.done });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditText(entry.text);
    setEditDue(entry.dueDate || "");
  }

  async function saveEdit(entry) {
    if (!editText.trim()) return;
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
    try {
      await api.deleteEntry(entry.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const overdue = (e) => e.kind === "todo" && !e.done && e.dueDate && e.dueDate < todayISODate();

  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-5 sm:py-8 md:pb-8">
        <Breadcrumbs items={[{ label: "Home", href: "/projects" }, { label: "Personal" }]} />

        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">Personal</h1>
          <p className="text-sm text-text-soft">
            Private notes &amp; to-dos — only you can see these. Everything is dated, so the
            calendar becomes a record of what you logged and completed each day.
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-[#FF5D73]/20 bg-[#2E1A1E] px-3 py-2 text-sm text-[#FF5D73]">
            {error}
          </p>
        )}

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-line bg-card p-4">
          <div className="mb-3 flex gap-1 rounded-full bg-ink-2 p-1">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  kind === k.value ? "bg-card text-text border border-line" : "text-text-soft hover:text-text"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <TextInput
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === "todo" ? "Add a to-do…" : "Write a note…"}
            className="mb-3"
          />

          <div className="mb-3 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
                On day
              </span>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {kind === "todo" && (
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-text-soft">
                  Due (optional — reminder)
                </span>
                <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>

        {/* Filters */}
        <div className="mb-4 flex items-center gap-1">
          {[
            { value: "all", label: "All" },
            { value: "todo", label: "To-dos" },
            { value: "note", label: "Notes" },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.value
                  ? "bg-card text-text border border-line"
                  : "text-text-soft hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
            <p className="text-sm text-text-soft">Nothing here yet.</p>
            <p className="mt-1 text-xs text-text-faint">
              Add a note or to-do above and it&apos;ll show up on its day.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section key={group.date}>
                <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">
                  {dateLabel(group.date)} · {group.date}
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.items.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3"
                    >
                      {e.kind === "todo" ? (
                        <button
                          type="button"
                          onClick={() => toggleDone(e)}
                          aria-label={e.done ? "Mark not done" : "Mark done"}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            e.done
                              ? "border-[#22D3A6] bg-[#22D3A6] text-[#0B0F14]"
                              : "border-line bg-ink-2 text-transparent hover:border-[#22D3A6]"
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#E8A23D]" />
                      )}

                      {editingId === e.id ? (
                        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                          <TextInput
                            autoFocus
                            value={editText}
                            onChange={(ev) => setEditText(ev.target.value)}
                            className="flex-1"
                          />
                          {e.kind === "todo" && (
                            <TextInput
                              type="date"
                              value={editDue}
                              onChange={(ev) => setEditDue(ev.target.value)}
                              className="sm:w-44"
                            />
                          )}
                          <div className="flex gap-1.5">
                            <Button variant="secondary" onClick={() => saveEdit(e)} className="min-h-9 px-3 py-1.5 text-xs">
                              Save
                            </Button>
                            <Button variant="ghost" onClick={() => setEditingId(null)} className="min-h-9 px-3 py-1.5 text-xs">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm ${
                                e.kind === "todo" && e.done ? "text-text-faint line-through" : "text-text"
                              }`}
                            >
                              {e.text}
                            </p>
                            <p className="mt-0.5 text-xs text-text-faint">
                              {e.kind === "todo" ? "To-do" : "Note"}
                              {e.dueDate && (
                                <span className={overdue(e) ? "text-[#FF5D73]" : ""}>
                                  {" "}
                                  · due {e.dueDate}
                                  {overdue(e) ? " (overdue)" : ""}
                                </span>
                              )}
                              {e.kind === "todo" && e.done && e.completedAt && (
                                <> · done {new Date(e.completedAt).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEdit(e)}
                            aria-label="Edit"
                            className="rounded-lg p-1.5 text-text-faint transition hover:bg-ink-2 hover:text-text"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(e)}
                            aria-label="Delete"
                            className="rounded-lg p-1.5 text-text-faint transition hover:bg-[#2E1A1E] hover:text-[#FF5D73]"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PersonalPage() {
  return (
    <AuthGuard>
      <PersonalView />
    </AuthGuard>
  );
}
