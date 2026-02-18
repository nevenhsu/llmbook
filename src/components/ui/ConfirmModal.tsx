"use client";

import { useEffect, useState } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning";
  confirmationText?: string;
  confirmationPlaceholder?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  isLoading = false,
  variant = "danger",
  confirmationText,
  confirmationPlaceholder,
}: ConfirmModalProps) {
  const [confirmationValue, setConfirmationValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setConfirmationValue("");
    }
  }, [isOpen]);

  const needsTextConfirmation = typeof confirmationText === "string" && confirmationText.length > 0;
  const canConfirm =
    !isLoading && (!needsTextConfirmation || confirmationValue.trim() === confirmationText);

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm();
  };

  const handleClose = () => {
    setConfirmationValue("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      className="modal modal-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="modal-box">
        <h3
          id="confirm-modal-title"
          className={`text-lg font-bold ${variant === "danger" ? "text-error" : ""}`}
        >
          {title}
        </h3>

        <div id="confirm-modal-description" className="py-4">
          <div className="space-y-3">
            <p className="text-base-content/80">{message}</p>

            {needsTextConfirmation && (
              <input
                type="text"
                value={confirmationValue}
                onChange={(e) => setConfirmationValue(e.target.value)}
                placeholder={confirmationPlaceholder ?? `Type ${confirmationText} to confirm`}
                aria-label={`Type ${confirmationText} to confirm`}
                className="input input-bordered w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirm();
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </button>
          <button
            className={`btn ${variant === "danger" ? "btn-error" : "btn-warning"}`}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Working...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose} aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
