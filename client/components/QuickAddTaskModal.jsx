"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Modal from "./Modal";
import { Field, TextInput, Select, Button } from "./FormControls";
import { api } from "@/lib/api";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// Quick add lets you file a task against ANY project without opening it first:
// pick the project, link it to one of that project's existing goals, hand it to
// a collaborator, and give it a due date (required — every task gets a date so
// it can surface in Today's Tasks, the calendar, and reports).
export default function QuickAddTaskModal({ open, onClose, projects, onCreated, defaultProjectId }) {
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId]
  );
  // Projects come from GET /api/projects already hydrated with their goals,
  // so the goal picker needs no extra request.
  const goals = selectedProject?.goals || [];

  // Read through a ref so the form only resets when the modal OPENS — the
  // projects array itself gets a new identity every time the parent reloads
  // after an add, which would otherwise wipe the "added" confirmation and the
  // due date we deliberately keep for the next task.
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  useEffect(() => {
    if (!open) return;
    setProjectId((current) => defaultProjectId || current || projectsRef.current[0]?.id || "");
    setTitle("");
    setGoalId("");
    setAssigneeId("");
    setDueDate("");
    setError("");
    setJustAdded(null);
  }, [open, defaultProjectId]);

  // Keep the selection pointing at something real: covers the modal being
  // opened before the project list has finished loading, and a selected
  // project disappearing after a reload.
  useEffect(() => {
    if (!open || projects.length === 0) return;
    if (!projects.some((p) => p.id === projectId)) setProjectId(projects[0].id);
  }, [open, projects, projectId]);

  // Assignees are project-scoped — switching projects reloads who can be
  // assigned and drops any selection that no longer applies.
  useEffect(() => {
    if (!open || !projectId) {
      setCollaborators([]);
      return;
    }
    let active = true;
    setLoadingPeople(true);
    setAssigneeId("");
    setGoalId("");
    api
      .listCollaborators(projectId)
      .then((data) => {
        if (active) setCollaborators(data.collaborators || []);
      })
      .catch(() => {
        if (active) setCollaborators([]);
      })
      .finally(() => {
        if (active) setLoadingPeople(false);
      });
    return () => {
      active = false;
    };
  }, [open, projectId]);

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
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }
    if (dueDate < todayISODate()) {
      setError("Due date can't be in the past.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createTask(projectId, {
        title: title.trim(),
        goalId: goalId || null,
        assigneeId: assigneeId || null,
        dueDate,
        status: "todo",
      });
      const projectName = selectedProject?.name;
      setJustAdded(projectName);
      // Keep project + due date so a run of tasks for the same day is quick.
      setTitle("");
      setGoalId("");
      setAssigneeId("");
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

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-paper px-4 py-6 text-center">
          <p className="text-sm font-semibold text-text">No projects yet</p>
          <p className="mt-1 text-xs text-text-faint">Create a project first, then tasks can live inside it.</p>
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
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

          <Field
            label="Linked goal (optional)"
            hint={goals.length === 0 ? "This project has no goals yet." : undefined}
          >
            <Select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              disabled={goals.length === 0}
            >
              <option value="">No linked goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assignee (optional)">
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={loadingPeople}
            >
              <option value="">{loadingPeople ? "Loading people…" : "Unassigned"}</option>
              {collaborators.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name || c.email}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Due date (required)">
            <TextInput
              type="date"
              required
              min={todayISODate()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>

          {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
          {justAdded && <p className="mb-2 text-sm text-good">Added to &ldquo;{justAdded}&rdquo;. Add another, or close.</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add task"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
