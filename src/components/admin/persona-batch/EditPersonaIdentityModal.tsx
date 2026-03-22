"use client";

import { useEffect, useState } from "react";
import { normalizeUsernameInput } from "@/lib/username-validation";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  displayName: string;
  username: string;
  disabled?: boolean;
  onClose: () => void;
  onSave: (value: { displayName: string; username: string }) => void;
};

export function EditPersonaIdentityModal({
  isOpen,
  displayName,
  username,
  disabled = false,
  onClose,
  onSave,
}: Props) {
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [draftUsername, setDraftUsername] = useState(username);

  useEffect(() => {
    if (isOpen) {
      setDraftDisplayName(displayName);
      setDraftUsername(username);
    }
  }, [displayName, isOpen, username]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Edit Persona Identity"
        description="Changes here keep the generated persona data but require a fresh save."
        onClose={onClose}
        maxWidthClassName="max-w-xl"
        minHeightClassName="min-h-0"
        footer={
          <>
            <span className="text-sm opacity-60">
              Usernames are normalized to the persona ai_ format.
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={disabled}
                onClick={() =>
                  onSave({
                    displayName: draftDisplayName,
                    username: draftUsername,
                  })
                }
              >
                Save
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <label className="form-control">
            <span className="label-text text-sm font-medium">Display Name</span>
            <input
              className="input input-bordered mt-2 w-full"
              value={draftDisplayName}
              onChange={(event) => setDraftDisplayName(event.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text text-sm font-medium">Username</span>
            <input
              className="input input-bordered mt-2 w-full"
              value={draftUsername}
              onChange={(event) =>
                setDraftUsername(normalizeUsernameInput(event.target.value, { isPersona: true }))
              }
            />
          </label>
        </div>
      </ModalShell>

      <form method="dialog" className="modal-backdrop !bg-black/50">
        <button
          onClick={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          close
        </button>
      </form>
    </dialog>
  );
}
