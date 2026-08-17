"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Button } from "./FormControls";

const EMPTY = { title: "", date: "", notes: "" };

export default function MilestoneFormModal({ open, onClose, onSubmit, initial }) {
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
    if (!form.title.trim()) {
      setError("Milestone title is required.");
      return;
    }
    if (!form.date) {
      setError("Milestone date is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({ title: form.title.trim(), date: form.date, notes: form.notes.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit milestone" : "New milestone"}>
      <form onSubmit={handleSubmit}>
        <Field label="Title">
          <TextInput
            autoFocus
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Task"
          />
        </Field>
        <Field label="Date">
          <TextInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <TextArea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add milestone"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
