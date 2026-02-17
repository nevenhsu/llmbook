"use client";

import { X, Lock } from "lucide-react";

// ── Create mode ───────────────────────────────────────────────────────────────

interface CreatePollEditorProps {
  editMode: false;
  options: string[];
  duration: string;
  onOptionsChange: (options: string[]) => void;
  onDurationChange: (duration: string) => void;
}

// ── Edit mode ─────────────────────────────────────────────────────────────────

interface EditPollEditorProps {
  editMode: true;
  existingOptions: string[];   // read-only (from DB)
  newOptions: string[];        // editable additions
  onNewOptionsChange: (options: string[]) => void;
}

type PollEditorProps = CreatePollEditorProps | EditPollEditorProps;

const MAX_OPTIONS = 6;

export default function PollEditor(props: PollEditorProps) {
  if (props.editMode) {
    return <EditPollEditor {...props} />;
  }
  return <CreatePollEditor {...props} />;
}

// ── Create ────────────────────────────────────────────────────────────────────

function CreatePollEditor({ options, duration, onOptionsChange, onDurationChange }: CreatePollEditorProps) {
  function updateOption(idx: number, value: string) {
    const next = [...options];
    next[idx] = value;
    onOptionsChange(next);
  }

  function removeOption(idx: number) {
    onOptionsChange(options.filter((_, i) => i !== idx));
  }

  function addOption() {
    if (options.length < MAX_OPTIONS) onOptionsChange([...options, ""]);
  }

  return (
    <div className="space-y-2">
      {options.map((opt, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder={`Option ${idx + 1}`}
            value={opt}
            onChange={(e) => updateOption(idx, e.target.value)}
            maxLength={200}
          />
          {options.length > 2 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => removeOption(idx)}
              aria-label="Remove option"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn btn-outline btn-sm w-full mt-2"
        onClick={addOption}
        disabled={options.length >= MAX_OPTIONS}
      >
        + Add Option
      </button>

      <select
        className="select select-bordered w-full mt-4"
        value={duration}
        onChange={(e) => onDurationChange(e.target.value)}
      >
        <option value="1">1 day</option>
        <option value="3">3 days</option>
        <option value="7">1 week</option>
      </select>
    </div>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────────────

function EditPollEditor({ existingOptions, newOptions, onNewOptionsChange }: EditPollEditorProps) {
  const totalOptions = existingOptions.length + newOptions.length;

  function updateNew(idx: number, value: string) {
    const next = [...newOptions];
    next[idx] = value;
    onNewOptionsChange(next);
  }

  function removeNew(idx: number) {
    onNewOptionsChange(newOptions.filter((_, i) => i !== idx));
  }

  function addNew() {
    if (totalOptions < MAX_OPTIONS) onNewOptionsChange([...newOptions, ""]);
  }

  return (
    <div className="space-y-2">
      {/* Existing options — read-only */}
      {existingOptions.map((opt, idx) => (
        <div key={`existing-${idx}`} className="flex gap-2">
          <input
            className="input input-bordered flex-1 cursor-not-allowed"
            value={opt}
            readOnly
            disabled
          />
          <div className="px-3 py-2 flex items-center text-base-content/40">
            <Lock size={16} />
          </div>
        </div>
      ))}

      {/* Separator */}
      {newOptions.length > 0 && existingOptions.length > 0 && (
        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 border-t border-neutral" />
          <span className="text-xs text-base-content/50 font-semibold">New Options</span>
          <div className="flex-1 border-t border-neutral" />
        </div>
      )}

      {/* New options — editable */}
      {newOptions.map((opt, idx) => (
        <div key={`new-${idx}`} className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder={`New option ${idx + 1}`}
            value={opt}
            onChange={(e) => updateNew(idx, e.target.value)}
            maxLength={200}
          />
          {newOptions.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => removeNew(idx)}
              aria-label="Remove option"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="btn btn-outline btn-sm w-full mt-2"
        onClick={addNew}
        disabled={totalOptions >= MAX_OPTIONS}
      >
        + Add New Option
      </button>

      <p className="text-xs text-base-content/50 mt-2">
        Existing poll options cannot be removed or edited. You can only add new options.
      </p>
    </div>
  );
}
