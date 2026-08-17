"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, Select, Button } from "./FormControls";
import { api } from "@/lib/api";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function QuickAddTaskModal({ open, onClose, projects, onCreated }) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  useEffect(() => {
    if (open) {
      setProjectId((current) => current || projects[0]?.id || "");
      setTitle("");
      setDueDate("");
      setError("");
      setJustAdded(null);
    }
  }, [open, projects]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!projectId) {
      setError("Choose a project first.");
      return;
    }
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (dueDate && dueDate < todayISODate()) {
      setError("Due date can't be in the past.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createTask(projectId, { title: title.trim(), dueDate: dueDate || null, status: "todo" });
      const projectName = projects.find((p) => p.id === projectId)?.name;
      setJustAdded(projectName);
      setTitle("");
      setDueDate("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick add task">
      <p className="mb-4 text-sm text-text-soft">
        Add a task straight from here — no need to open the project first.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Task title">
          <TextInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task"
          />
        </Field>
        <Field label="Due date (optional)">
          <TextInput type="date" min={todayISODate()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
        {justAdded && <p className="mb-2 text-sm text-good">Added to "{justAdded}". Add another, or close.</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button type="submit" disabled={busy || projects.length === 0}>
            {busy ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
