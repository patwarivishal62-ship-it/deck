"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Select, Button } from "./FormControls";
import { STATUSES } from "@/lib/constants";
import { api } from "@/lib/api";

const EMPTY = { title: "", notes: "", goalId: "", status: "todo", dueDate: "", assigneeId: "" };

// Used as the date input's min= — stops the calendar picker from offering
// past dates for a NEW selection. An already-stored past due date (a task
// that's simply become overdue with time) still displays fine; this only
// restricts what you can newly pick.
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function TaskFormModal({ open, onClose, onSubmit, initial, goals, projectId }) {
  const [form, setForm] = useState(EMPTY);
  const [collaborators, setCollaborators] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              ...EMPTY,
              ...initial,
              goalId: initial.goalId || "",
              dueDate: initial.dueDate || "",
              assigneeId: initial.assigneeId || "",
            }
          : EMPTY
      );
      setError("");
      api
        .listCollaborators(projectId)
        .then((data) => setCollaborators(data.collaborators))
        .catch(() => setCollaborators([]));
    }
  }, [open, initial, projectId]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (form.dueDate && form.dueDate !== initial?.dueDate && form.dueDate < todayISODate()) {
      setError("Due date can't be in the past.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        notes: form.notes.trim(),
        goalId: form.goalId || null,
        dueDate: form.dueDate || null,
        assigneeId: form.assigneeId || null,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit task" : "New task"}>
      <form onSubmit={handleSubmit}>
        <Field label="Task title">
          <TextInput
            autoFocus
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Task"
          />
        </Field>
        <Field label="Notes (optional)">
          <TextArea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label="Linked goal (optional)">
          <Select value={form.goalId} onChange={(e) => set("goalId", e.target.value)}>
            <option value="">No linked goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee (optional)">
          <Select value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
            <option value="">Unassigned</option>
            {collaborators.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name || c.email}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date (optional)">
            <TextInput
              type="date"
              min={todayISODate()}
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </Field>
        </div>
        {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
