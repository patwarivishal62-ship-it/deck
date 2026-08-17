"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import { Field, TextInput, Select, Button } from "./FormControls";
import { CATEGORIES, CATEGORY_KEYS, METRIC_CATALOG } from "@/lib/constants";

const UNIT_OPTIONS = [
  { value: "count", label: "Count" },
  { value: "percent", label: "Percent (%)" },
  { value: "currency", label: "Currency" },
  { value: "ratio", label: "Ratio (x)" },
];

const CUSTOM_VALUE = "__custom__";

export default function MetricFormModal({ open, onClose, onSubmit }) {
  const [category, setCategory] = useState("social");
  const [selection, setSelection] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [unit, setUnit] = useState("count");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const catalogForCategory = METRIC_CATALOG[category] || [];

  useEffect(() => {
    if (open) {
      setCategory("social");
      setSelection(METRIC_CATALOG.social[0]?.key || CUSTOM_VALUE);
      setCustomLabel("");
      setUnit(METRIC_CATALOG.social[0]?.unit || "count");
      setError("");
    }
  }, [open]);

  function handleCategoryChange(newCategory) {
    setCategory(newCategory);
    const first = METRIC_CATALOG[newCategory]?.[0];
    if (first) {
      setSelection(first.key);
      setUnit(first.unit);
    } else {
      setSelection(CUSTOM_VALUE);
    }
  }

  function handleSelectionChange(value) {
    setSelection(value);
    if (value === CUSTOM_VALUE) return;
    const catalogEntry = catalogForCategory.find((m) => m.key === value);
    if (catalogEntry) setUnit(catalogEntry.unit);
  }

  const isCustom = selection === CUSTOM_VALUE;
  const selectedCatalogEntry = catalogForCategory.find((m) => m.key === selection);

  async function handleSubmit(e) {
    e.preventDefault();
    const label = isCustom ? customLabel.trim() : selectedCatalogEntry?.label;
    if (!label) {
      setError("Metric name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({ category, key: isCustom ? null : selection, label, unit });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Track a new metric">
      <form onSubmit={handleSubmit}>
        <Field label="Category">
          <Select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORIES[key].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Metric">
          <Select value={selection} onChange={(e) => handleSelectionChange(e.target.value)}>
            {catalogForCategory.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
            <option value={CUSTOM_VALUE}>Custom…</option>
          </Select>
        </Field>

        {isCustom && (
          <Field label="Custom metric name">
            <TextInput
              autoFocus
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Name"
            />
          </Field>
        )}

        <Field label="Unit">
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
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
            {busy ? "Adding…" : "Start tracking"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
