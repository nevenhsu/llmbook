"use client";

function classesForStatus(status: string): string {
  switch (status) {
    case "RUNNING":
      return "badge-info";
    case "PENDING":
    case "IN_REVIEW":
      return "badge-warning";
    case "DONE":
      return "badge-success";
    case "FAILED":
      return "badge-error";
    case "SKIPPED":
      return "badge-ghost";
    case "Paused":
      return "badge-warning";
    case "Idle":
      return "badge-ghost";
    default:
      return "badge-outline";
  }
}

export default function OperatorStatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-sm ${classesForStatus(status)}`}>{status}</span>;
}
