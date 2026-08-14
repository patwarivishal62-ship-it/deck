"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, formatMetricValue } from "@/lib/constants";
import { Button, Field, TextInput } from "./FormControls";
import MetricFormModal from "./MetricFormModal";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function Sparkline({ entries, color }) {
  if (entries.length < 2) return null;
  const values = entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const points = entries
    .map((e, i) => {
      const x = (i / (entries.length - 1)) * w;
      const y = h - ((e.value - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricRow({ metric, canManage, onDelete, onEntryAdded, onEntryRemoved }) {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(todayISODate());
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const entries = metric.entries || [];
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const color = (CATEGORIES[metric.category] || CATEGORIES.other).color;

  let trend = null;
  if (latest && previous) {
    const diff = latest.value - previous.value;
    trend = diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  }

  async function handleLogEntry(e) {
    e.preventDefault();
    if (value === "" || Number.isNaN(Number(value))) {
      setError("Enter a numeric value.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onEntryAdded(metric, { date, value: Number(value), note: note.trim() });
      setValue("");
      setNote("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-sm font-medium text-text">{metric.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">
            {(CATEGORIES[metric.category] || CATEGORIES.other).label}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <Sparkline entries={entries} color={color} />
          {latest ? (
            <span className="flex items-center gap-1 font-mono text-sm text-text">
              {formatMetricValue(latest.value, metric.unit)}
              {trend && (
                <span className={trend === "up" ? "text-good" : trend === "down" ? "text-signal-deep" : "text-text-faint"}>
                  {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
                </span>
              )}
            </span>
          ) : (
            <span className="font-mono text-xs text-text-faint">No data yet</span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => onDelete(metric)}
              aria-label="Delete metric"
              className="rounded-md p-1 text-text-faint hover:bg-signal-tint hover:text-signal-deep"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-line pt-3">
          {entries.length > 0 && (
            <div className="mb-3 flex flex-col gap-1">
              {[...entries].reverse().map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="text-text-soft">
                    {entry.date} — {formatMetricValue(entry.value, metric.unit)}
                    {entry.note && <span className="text-text-faint"> · {entry.note}</span>}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onEntryRemoved(metric, entry.id)}
                      className="text-text-faint hover:text-signal-deep"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <form onSubmit={handleLogEntry} className="flex flex-wrap items-end gap-2">
              <div className="w-36">
                <Field label="Date">
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
              <div className="w-28">
                <Field label="Value">
                  <TextInput
                    type="number"
                    step="any"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>
              <div className="min-w-[140px] flex-1">
                <Field label="Note (optional)">
                  <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context…" />
                </Field>
              </div>
              <Button type="submit" disabled={busy} className="mb-3">
                {busy ? "Logging…" : "Log"}
              </Button>
              {error && <p className="w-full text-xs text-signal-deep">{error}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function MetricsPanel({ projectId, canManage }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    api
      .listMetrics(projectId)
      .then((data) => setMetrics(data.metrics))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleCreate(values) {
    const data = await api.createMetric(projectId, values);
    setMetrics((prev) => [...prev, data.metric]);
  }

  async function handleDelete(metric) {
    if (!confirm(`Stop tracking "${metric.label}"? This deletes its logged history too.`)) return;
    try {
      await api.deleteMetric(projectId, metric.id);
      setMetrics((prev) => prev.filter((m) => m.id !== metric.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEntryAdded(metric, entry) {
    const data = await api.addMetricEntry(projectId, metric.id, entry);
    setMetrics((prev) => prev.map((m) => (m.id === metric.id ? data.metric : m)));
  }

  async function handleEntryRemoved(metric, entryId) {
    try {
      const data = await api.deleteMetricEntry(projectId, metric.id, entryId);
      setMetrics((prev) => prev.map((m) => (m.id === metric.id ? data.metric : m)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-soft">Track channel-specific numbers over time — not a target, just what's happening.</p>
        {canManage && <Button variant="ghost" onClick={() => setFormOpen(true)}>+ Track metric</Button>}
      </div>

      {error && <p className="mb-3 text-sm text-signal-deep">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-wide text-text-faint">Loading…</p>
      ) : metrics.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-card px-4 py-6 text-center text-sm text-text-soft">
          No metrics yet. {canManage && "Track something like CTR, Reach, or Open Rate to see it trend over time."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {metrics.map((metric) => (
            <MetricRow
              key={metric.id}
              metric={metric}
              canManage={canManage}
              onDelete={handleDelete}
              onEntryAdded={handleEntryAdded}
              onEntryRemoved={handleEntryRemoved}
            />
          ))}
        </div>
      )}

      <MetricFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
