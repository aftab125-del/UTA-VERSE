"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel, danger }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-overlay" role="alertdialog" aria-label={title} onClick={onCancel}>
      <div className="modal-card modal-card--compact" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{title}</h3>
        </div>
        <div className="modal-card__body">
          <p className="confirm-dialog__message">{message}</p>
          <div className="confirm-dialog__actions">
            <button type="button" className="confirm-dialog__cancel" onClick={onCancel}>Cancel</button>
            <button type="button" className={`confirm-dialog__confirm${danger ? " confirm-dialog__confirm--danger" : ""}`} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
