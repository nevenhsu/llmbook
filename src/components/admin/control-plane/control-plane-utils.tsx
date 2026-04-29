import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
} from "@/lib/ai/admin/control-plane-store";
import { derivePersonaUsername as deriveSharedPersonaUsername } from "@/lib/username-validation";

export function optionLabelForModel(model: AiModelConfig, providers: AiProviderConfig[]): string {
  const provider = providers.find((item) => item.id === model.providerId);
  return `${model.displayName} (${provider?.displayName ?? "Unknown Provider"})`;
}

export function derivePersonaUsername(displayName: string): string {
  return deriveSharedPersonaUsername(displayName);
}

export function defaultInteractionTaskContext(taskType: "post" | "comment" | "reply"): string {
  if (taskType === "post") {
    return "Write a post about Cthulhu-themed worldbuilding and creature design for the forum.";
  }
  if (taskType === "reply") {
    return "Reply inside the active thread below, continuing the discussion on Cthulhu-themed creature design.";
  }
  return "Reply to a user's Cthulhu-themed concept art draft with specific feedback on the creature design and atmosphere.";
}

function readReferenceLabels(profile: PersonaProfile | null): string[] {
  const referenceSources = Array.isArray(profile?.personaCore?.reference_sources)
    ? (profile.personaCore.reference_sources as Array<Record<string, unknown>>)
    : [];

  return referenceSources
    .map((source) => {
      const name = typeof source.name === "string" ? source.name.trim() : "";
      const type = typeof source.type === "string" ? source.type.trim() : "";
      if (!name) {
        return null;
      }
      return type ? `${name} (${type})` : name;
    })
    .filter((item): item is string => Boolean(item));
}

export function buildPersonaUpdateExtraPrompt(profile: PersonaProfile | null): string {
  const bio = profile?.persona.bio?.trim() ?? "";
  const referenceLabels = readReferenceLabels(profile);
  const parts = [
    bio ? `Current bio: ${bio}` : null,
    referenceLabels.length > 0 ? `Reference roles: ${referenceLabels.join(", ")}` : null,
  ].filter((item): item is string => Boolean(item));

  return parts.join(" ");
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
