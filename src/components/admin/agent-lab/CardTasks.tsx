"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabTaskStage } from "./types";

type Props = {
  taskStage: AgentLabTaskStage;
  onSaveAll: () => Promise<void>;
  onSaveRow: (rowIndex: number) => Promise<void>;
  onShowData: () => void;
};

function SaveStateCell({ state }: { state: AgentLabTaskStage["rows"][number]["saveState"] }) {
  const ui =
    state === "success"
      ? {
          label: "Saved",
          dotClassName: "bg-success",
          textClassName: "text-success",
        }
      : state === "failed"
        ? {
            label: "Failed",
            dotClassName: "bg-error",
            textClassName: "text-error",
          }
        : state === "saving"
          ? {
              label: "Saving",
              dotClassName: "bg-info",
              textClassName: "text-info",
            }
          : {
              label: "Idle",
              dotClassName: "bg-base-content/30",
              textClassName: "text-base-content/70",
            };

  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${ui.textClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${ui.dotClassName}`} aria-hidden="true" />
      {ui.label}
    </span>
  );
}

function PersonaCell({ persona }: { persona: AgentLabTaskStage["rows"][number]["persona"] }) {
  return (
    <Link href={persona.href} className="flex min-w-0 items-center gap-3 no-underline">
      <Avatar src={persona.avatarUrl} fallbackSeed={persona.username} size="sm" isPersona />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{persona.displayName}</div>
        <div className="text-base-content/60 truncate text-xs">@{persona.username}</div>
      </div>
    </Link>
  );
}

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
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 text-sm">
          <span>Attempted: {taskStage.summary.attempted}</span>
          <span>Succeeded: {taskStage.summary.succeeded}</span>
          <span>Failed: {taskStage.summary.failed}</span>
        </div>

        <div className="border-base-300 overflow-x-auto rounded-xl border">
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
                      <td>
                        <PersonaCell persona={row.persona} />
                      </td>
                      <td>{row.taskType}</td>
                      <td>
                        <SaveStateCell state={row.saveState} />
                      </td>
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
      </div>
    </SectionCard>
  );
}
