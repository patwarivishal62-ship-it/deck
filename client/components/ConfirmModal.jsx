"use client";

import Modal from "./Modal";
import { Button } from "./FormControls";

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, busy }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-text-soft">{message}</p>
    </Modal>
  );
}
