"use client";

import { useState } from "react";

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
}: ConfirmModalProps) {
  const [step, setStep] = useState(1);

  const handleOpen = () => {
    setStep(1);
  };

  const handleConfirm = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onConfirm();
    }
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className={`font-bold text-lg ${step === 1 ? "" : "text-error"}`}>
          {step === 1 ? title : "Final Confirmation"}
        </h3>

        <div className="py-4">
          {step === 1 ? (
            <p className="text-base-content/80">{message}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-error font-medium">
                This action cannot be undone. The {message.toLowerCase().includes("comment") ? "comment" : "post"} will be permanently deleted.
              </p>
              <p className="text-sm text-base-content/60">
                Are you absolutely sure? Type <span className="font-mono font-bold">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                placeholder="Type DELETE"
                className="input input-bordered w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="modal-action">
          <button
            className="btn btn-ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`btn ${variant === "danger" ? "btn-error" : "btn-warning"}`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
