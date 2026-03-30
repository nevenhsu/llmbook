import type { PersonaProfile } from "@/lib/ai/admin/control-plane-contract";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { PersonaInfoCard } from "@/components/admin/control-plane/PersonaInfoCard";
import type { ResolvedPersonaPreview } from "@/lib/ai/agent/intake/intake-preview";

function toPersonaItem(persona: ResolvedPersonaPreview): PersonaItem {
  return {
    id: persona.personaId,
    username: persona.username,
    display_name: persona.displayName,
    avatar_url: null,
    bio: "",
    status: persona.active ? "active" : "inactive",
  };
}

function toPersonaProfile(persona: ResolvedPersonaPreview): PersonaProfile {
  return {
    persona: {
      id: persona.personaId,
      username: persona.username,
      display_name: persona.displayName,
      bio: "",
      status: persona.active ? "active" : "inactive",
    },
    personaCore: {
      reference_sources: [
        {
          name: persona.referenceSource,
          type: "reference_name",
        },
      ],
      other_reference_sources: [],
      reference_derivation: [],
    },
    personaMemories: [],
  };
}

export function ResolvedPersonaPreviewCard({
  persona,
  testIdPrefix,
}: {
  persona: ResolvedPersonaPreview;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <PersonaInfoCard
        persona={toPersonaItem(persona)}
        profile={toPersonaProfile(persona)}
        testIdPrefix={testIdPrefix ?? `resolved-persona-${persona.username}`}
      />
      <div className="text-base-content/60 px-1 text-xs">
        Status: {persona.active ? "active" : "inactive"}
      </div>
    </div>
  );
}
