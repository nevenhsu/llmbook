"use client";

import toast from "react-hot-toast";
import type {
  PersonaBatchActionType,
  PersonaBatchRow,
} from "@/lib/ai/admin/persona-batch-contract";
import { TaskStatusBadge } from "@/components/shared/TaskStatusBadge";

type Props = {
  row: PersonaBatchRow;
  bulkTask: "check" | "prompt" | "generate" | "save" | null;
  anyApiActive: boolean;
  onEditContextPrompt: () => void;
  onEditIdentity: () => void;
  onViewPersona: () => void;
  onViewError: () => void;
  onRunPromptAssist: () => void;
  onRunGenerate: () => void;
  onRunSave: () => void;
  onClear: () => void;
};

function referenceTone(status: PersonaBatchRow["referenceCheckStatus"]) {
  switch (status) {
    case "new":
      return "success";
    case "duplicate":
      return "warning";
    case "check_error":
      return "error";
    case "checking":
      return "info";
    default:
      return "neutral";
  }
}

function referenceLabel(status: PersonaBatchRow["referenceCheckStatus"]) {
  switch (status) {
    case "new":
      return "New";
    case "duplicate":
      return "Duplicate";
    case "check_error":
      return "Unchecked";
    case "checking":
      return "Checking";
    default:
      return "Unchecked";
  }
}

function taskLabel(task: PersonaBatchRow["activeTask"] | PersonaBatchRow["lastCompletedTask"]) {
  if (task === "prompt") {
    return "Prompt";
  }
  if (task === "generate") {
    return "Generate";
  }
  if (task === "save") {
    return "Save";
  }
  return null;
}

function taskTone(
  task: PersonaBatchRow["activeTask"] | PersonaBatchRow["lastCompletedTask"],
): "neutral" | "info" | "success" {
  if (task === "generate") {
    return "info";
  }
  if (task === "save") {
    return "success";
  }
  return "neutral";
}

function errorLabel(type: PersonaBatchActionType) {
  switch (type) {
    case "check":
      return "View check error";
    case "prompt":
      return "View prompt error";
    case "generate":
      return "View generate error";
    case "save":
      return "View save error";
    default:
      return "View error";
  }
}

function summarize(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "—";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function PersonaBatchRow({
  row,
  bulkTask,
  anyApiActive,
  onEditContextPrompt,
  onEditIdentity,
  onViewPersona,
  onViewError,
  onRunPromptAssist,
  onRunGenerate,
  onRunSave,
  onClear,
}: Props) {
  const rowBusy = row.activeTask !== null;
  const rowDisabled = bulkTask !== null || rowBusy;
  const canPrompt = row.referenceCheckStatus === "new" && !rowDisabled && bulkTask === null;
  const canGenerate =
    row.referenceCheckStatus === "new" &&
    row.contextPrompt.trim().length > 0 &&
    !rowDisabled &&
    bulkTask === null;
  const canSave =
    row.referenceCheckStatus === "new" &&
    row.personaData !== null &&
    !row.saved &&
    !rowDisabled &&
    bulkTask === null;
  const canEditContextPrompt = !anyApiActive && row.referenceCheckStatus !== "duplicate";
  const canEditIdentity = !anyApiActive && row.personaData !== null;
  const runningTaskLabel = taskLabel(row.activeTask);
  const completedTaskLabel = taskLabel(row.lastCompletedTask);
  const generateLabel = row.personaData ? "Regenerate" : "Generate";
  const borderedCellClass = "border-base-content/20 border-r border-b align-top";
  const lastBorderedCellClass = "border-base-content/20 border-b align-top";
  const smallOutlineButtonClass = "btn btn-outline btn-xs";
  const errorOutlineButtonClass = "btn btn-outline btn-error btn-xs";
  const canCopyContextPrompt = row.contextPrompt.trim().length > 0;

  const handleCopyContextPrompt = async () => {
    if (!canCopyContextPrompt) {
      return;
    }
    try {
      await navigator.clipboard.writeText(row.contextPrompt);
      toast.success("Context prompt copied");
    } catch {
      toast.error("Failed to copy context prompt");
    }
  };

  return (
    <tr className="align-top">
      <td className={`${borderedCellClass} space-y-2`}>
        <div className="font-medium">{row.referenceName}</div>
        <TaskStatusBadge
          label={referenceLabel(row.referenceCheckStatus)}
          tone={referenceTone(row.referenceCheckStatus)}
        />
      </td>

      <td className={`${borderedCellClass} w-[180px] max-w-[180px] min-w-[180px] space-y-2`}>
        <div className="truncate text-sm leading-6 opacity-80" title={row.contextPrompt}>
          {summarize(row.contextPrompt)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.promptChangedSinceGenerate ? (
            <span className="badge badge-warning badge-outline text-xs">Prompt changed</span>
          ) : null}
          <button
            type="button"
            className={smallOutlineButtonClass}
            disabled={!canCopyContextPrompt}
            onClick={handleCopyContextPrompt}
          >
            Copy
          </button>
          <button
            type="button"
            className={smallOutlineButtonClass}
            disabled={!canEditContextPrompt}
            onClick={onEditContextPrompt}
          >
            Edit
          </button>
        </div>
      </td>

      <td className={`${borderedCellClass} space-y-2`}>
        <div className="text-sm font-medium">{row.displayName || "—"}</div>
        <div className="font-mono text-xs opacity-65">{row.username || "—"}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={smallOutlineButtonClass}
            disabled={!canEditIdentity}
            onClick={onEditIdentity}
          >
            Edit
          </button>
          <button
            type="button"
            className={smallOutlineButtonClass}
            disabled={row.personaData === null}
            onClick={onViewPersona}
          >
            View
          </button>
        </div>
      </td>

      <td className={borderedCellClass}>
        {runningTaskLabel ? (
          <TaskStatusBadge
            label={runningTaskLabel}
            elapsedSeconds={row.activeElapsedSeconds}
            tone={taskTone(row.activeTask)}
          />
        ) : completedTaskLabel ? (
          <TaskStatusBadge
            label={completedTaskLabel}
            elapsedSeconds={row.lastCompletedElapsedSeconds}
            tone={taskTone(row.lastCompletedTask)}
          />
        ) : (
          <span className="text-sm opacity-45">—</span>
        )}
      </td>

      <td className={borderedCellClass}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-xs gap-2"
            disabled={!canPrompt}
            onClick={onRunPromptAssist}
          >
            {row.activeTask === "prompt" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Prompt
          </button>
          <button
            type="button"
            className="btn btn-outline btn-xs gap-2"
            disabled={!canGenerate}
            onClick={onRunGenerate}
          >
            {row.activeTask === "generate" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            {generateLabel}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-xs gap-2"
            disabled={!canSave}
            onClick={onRunSave}
          >
            {row.activeTask === "save" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            {row.saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            className={errorOutlineButtonClass}
            disabled={anyApiActive}
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </td>

      <td className={lastBorderedCellClass}>
        {row.latestError ? (
          <button type="button" className="btn btn-outline btn-error btn-xs" onClick={onViewError}>
            {errorLabel(row.latestError.type)}
          </button>
        ) : (
          <span className="text-sm opacity-45">—</span>
        )}
      </td>
    </tr>
  );
}
