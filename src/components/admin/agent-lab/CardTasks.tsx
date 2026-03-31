"use client";

import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabTaskStage } from "./types";

type Props = {
  taskStage: AgentLabTaskStage;
  onSaveAll: () => Promise<void>;
  onSaveRow: (rowIndex: number) => Promise<void>;
  onShowData: () => void;
};

export function CardTasks({ taskStage, onSaveAll, onSaveRow, onShowData }: Props) {
  const hasSavableRows = taskStage.rows.some((row) => row.actions.canSave);

  return (
    <SectionCard
      title="Tasks"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={!hasSavableRows}
            onClick={() => void onSaveAll()}
          >
            Save All
          </button>
          <button className="btn btn-outline btn-sm" onClick={onShowData}>
            Show Data
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-3 text-sm">
        <span>Attempted: {taskStage.summary.attempted}</span>
        <span>Succeeded: {taskStage.summary.succeeded}</span>
        <span>Failed: {taskStage.summary.failed}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="table-sm table">
          <thead>
            <tr>
              <th>Opportunity Key</th>
              <th>Persona</th>
              <th>Task Type</th>
              <th>Save State</th>
              <th>Error Message</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {taskStage.rows.length > 0 ? (
              taskStage.rows.map((row, rowIndex) => {
                const label =
                  row.saveState === "success"
                    ? "Saved"
                    : row.saveState === "saving"
                      ? "Saving..."
                      : "Save";
                return (
                  <tr key={`${row.opportunityKey}-${row.persona.id}-${rowIndex}`}>
                    <td>{row.opportunityKey}</td>
                    <td>{row.persona.displayName}</td>
                    <td>{row.taskType}</td>
                    <td>{row.saveState}</td>
                    <td className={row.errorMessage ? "text-error" : ""}>
                      {row.errorMessage ?? "-"}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-xs"
                        disabled={!row.actions.canSave || row.saveState === "saving"}
                        onClick={() => void onSaveRow(rowIndex)}
                      >
                        {label}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-base-content/60 text-center">
                  No task rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
