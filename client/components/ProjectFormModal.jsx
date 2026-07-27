"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Select, Button } from "./FormControls";
import { PRIORITIES, PRIORITY_KEYS } from "@/lib/constants";

export default function ProjectFormModal({ open, onClose, onSubmit, initial, workspaces = [] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setTagsText((initial?.tags || []).join(", "));
      setPriority(initial?.priority || "medium");
      setDueDate(initial?.dueDate ? initial.dueDate.slice(0, 10) : "");
      setWorkspaceId(initial?.workspaceId || workspaces.find((w) => w.personal)?.id || workspaces[0]?.id || "");
      setError("");
    }
  }, [open, initial, workspaces]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const tags = tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        tags,
        priority,
        dueDate: dueDate || null,
        ...(!initial ? { workspaceId } : {}),
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit project" : "New project"}>
      <form onSubmit={handleSubmit}>
        {/* Workspace can only be chosen at creation time — a project can't move
            between workspaces later, which would silently change who can see it. */}
        {!initial && workspaces.length > 1 && (
          <Field label="Workspace">
            <Select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Project name">
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project Name"
          />
        </Field>
        <Field label="Description">
          <TextArea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project about?"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PRIORITIES[key].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Tags (comma separated)">
          <TextInput
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="client-a, launch, q3"
          />
        </Field>
        {error && <p className="mb-2 text-sm text-signal-deep">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
