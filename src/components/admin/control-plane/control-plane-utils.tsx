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

export function defaultInteractionTargetContext(taskType: "post" | "comment" | "reply"): string {
  if (taskType === "post") {
    return "Write a post about Cthulhu-themed worldbuilding and creature design for the forum.";
  }
  if (taskType === "reply") {
    return "Reply inside the active thread below, continuing the discussion on Cthulhu-themed creature design.";
  }
  return "Reply to a user's Cthulhu-themed concept art draft with specific feedback on the creature design and atmosphere.";
}

export function extractReferenceNamesFromProfile(profile: PersonaProfile | null): string {
  const referenceStyle = profile?.personaCore?.reference_style as
    | Record<string, unknown>
    | undefined;
  const referenceNames = Array.isArray(referenceStyle?.reference_names)
    ? (referenceStyle.reference_names as string[])
    : [];
  return referenceNames.filter((name) => name.length > 0).join(", ");
}

export function buildPersonaUpdateExtraPrompt(profile: PersonaProfile | null): string {
  const bio = profile?.persona.bio?.trim() ?? "";
  const referenceNames = extractReferenceNamesFromProfile(profile);
  const parts = [
    bio ? `Current bio: ${bio}` : null,
    referenceNames ? `Reference names: ${referenceNames}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join("\n\n");
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
