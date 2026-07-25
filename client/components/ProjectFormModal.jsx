"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, TextArea, Button } from "./FormControls";

export default function ProjectFormModal({ open, onClose, onSubmit, initial }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setError("");
    }
  }, [open, initial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
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
