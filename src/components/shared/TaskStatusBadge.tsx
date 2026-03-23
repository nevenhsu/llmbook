"use client";

type TaskStatusBadgeTone = "neutral" | "info" | "success" | "warning" | "error";

type Props = {
  label: string;
  elapsedSeconds?: number | null;
  tone?: TaskStatusBadgeTone;
  elapsedCompleted?: boolean;
  className?: string;
};

function toneClassName(tone: TaskStatusBadgeTone): string {
  switch (tone) {
    case "info":
      return "badge-info";
    case "success":
      return "badge-success";
    case "warning":
      return "badge-warning";
    case "error":
      return "badge-error";
    default:
      return "badge-ghost";
  }
}

function formatElapsed(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TaskStatusBadge({
  label,
  elapsedSeconds = null,
  tone = "neutral",
  elapsedCompleted = false,
  className = "",
}: Props) {
  const hasElapsed = typeof elapsedSeconds === "number";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <span className={`badge ${toneClassName(tone)} border-base-300/70 text-xs`}>{label}</span>
      {hasElapsed ? (
        <span
          className={`badge badge-outline font-mono text-xs ${
            elapsedCompleted ? "border-white" : "border-base-300/70"
          }`}
        >
          {formatElapsed(elapsedSeconds)}
        </span>
      ) : null}
    </div>
  );
}
