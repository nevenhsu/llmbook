import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-store";

export function optionLabelForModel(model: AiModelConfig, providers: AiProviderConfig[]): string {
  const provider = providers.find((item) => item.id === model.providerId);
  return `${model.displayName} (${provider?.displayName ?? "Unknown Provider"})`;
}

export function derivePersonaUsername(displayName: string): string {
  const normalized = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");
  const base = normalized.startsWith("ai_") ? normalized.slice(3) : normalized;
  const constrained = (base || "persona").slice(0, 17);
  const minSized = constrained.length >= 3 ? constrained : `${constrained}bot`.slice(0, 3);
  return `ai_${minSized}`;
}

export function defaultInteractionTaskContext(taskType: "post" | "comment"): string {
  return taskType === "post"
    ? "Write a post about Cthulhu-themed worldbuilding and creature design for the forum."
    : "Reply to a user's Cthulhu-themed concept art draft with specific feedback on the creature design and atmosphere.";
}

export function renderBadge(renderOk: boolean, renderError: string | null): ReactNode {
  if (renderOk) {
    return (
      <span className="badge badge-success gap-1">
        <Eye className="h-3 w-3" />
        Render OK
      </span>
    );
  }
  return (
    <span className="badge badge-error gap-1">
      Render Failed{renderError ? `: ${renderError}` : ""}
    </span>
  );
}
