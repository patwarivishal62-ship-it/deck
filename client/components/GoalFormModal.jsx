"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, Select, Button } from "./FormControls";
import { CATEGORIES, CATEGORY_KEYS, PERIODS } from "@/lib/constants";

const EMPTY = {
  category: "social",
  platform: "",
  label: "",
  targetValue: 10,
  currentValue: 0,
  unit: "",
  period: "monthly",
  step: 1,
};

export default function GoalFormModal({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setError("");
    }
  }, [open, initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.label.trim()) {
      setError("Goal label is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        label: form.label.trim(),
        platform: form.platform.trim(),
        unit: form.unit.trim(),
        targetValue: Number(form.targetValue) || 0,
        currentValue: Number(form.currentValue) || 0,
        step: Number(form.step) || 1,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit goal" : "New goal"}>
      <form onSubmit={handleSubmit}>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORIES[key].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Platform (optional)">
          <TextInput
            value={form.platform}
            onChange={(e) => set("platform", e.target.value)}
            placeholder="Instagram, Google Ads, etc."
          />
        </Field>
        <Field label="Goal label">
          <TextInput
            autoFocus
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Post Reels"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target value">
            <TextInput
              type="number"
              value={form.targetValue}
              onChange={(e) => set("targetValue", e.target.value)}
            />
          </Field>
          <Field label="Current value">
            <TextInput
              type="number"
              value={form.currentValue}
              onChange={(e) => set("currentValue", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit (optional)">
            <TextInput value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="reels" />
          </Field>
          <Field label="Step size">
            <TextInput type="number" value={form.step} onChange={(e) => set("step", e.target.value)} />
          </Field>
        </div>
        <Field label="Period">
          <Select value={form.period} onChange={(e) => set("period", e.target.value)}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create goal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
