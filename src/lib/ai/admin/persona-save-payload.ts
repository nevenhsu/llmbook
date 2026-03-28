import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-contract";
import { derivePersonaUsername, normalizeUsernameInput } from "@/lib/username-validation";

type PersonaMemoryApiPayload = {
  memoryType: "memory" | "long_memory";
  scope: "persona";
  content: string;
  metadata: PersonaGenerationStructured["persona_memories"][number]["metadata"];
  expiresAt: string | null;
  importance: number;
};

type PersonaSavePayloadBase = {
  bio: string;
  personaCore: Record<string, unknown>;
  referenceSources: PersonaGenerationStructured["reference_sources"];
  otherReferenceSources: PersonaGenerationStructured["other_reference_sources"];
  referenceDerivation: string[];
  originalizationNote: string;
  personaMemories: PersonaMemoryApiPayload[];
};

function resolvePersonaIdentity(input: {
  structured: PersonaGenerationStructured;
  displayName?: string;
  username?: string;
}) {
  const displayName = input.displayName?.trim() || input.structured.persona.display_name;
  const username = input.username?.trim()
    ? normalizeUsernameInput(input.username, { isPersona: true })
    : derivePersonaUsername(displayName);

  return { displayName, username };
}

export function mapStructuredPersonaMemoriesToApiMemories(
  memories: PersonaGenerationStructured["persona_memories"],
  options: {
    now?: Date;
  } = {},
): PersonaMemoryApiPayload[] {
  const now = options.now ?? new Date();

  return memories.map((item) => ({
    memoryType: item.memory_type,
    scope: item.scope,
    content: item.content,
    metadata: item.metadata,
    expiresAt:
      item.expires_in_hours && item.expires_in_hours > 0
        ? new Date(now.getTime() + item.expires_in_hours * 3600_000).toISOString()
        : null,
    importance: item.importance,
  }));
}

function buildPersonaSavePayloadBase(input: {
  structured: PersonaGenerationStructured;
  now?: Date;
}): PersonaSavePayloadBase {
  return {
    bio: input.structured.persona.bio,
    personaCore: input.structured.persona_core,
    referenceSources: input.structured.reference_sources,
    otherReferenceSources: input.structured.other_reference_sources,
    referenceDerivation: input.structured.reference_derivation,
    originalizationNote: input.structured.originalization_note,
    personaMemories: mapStructuredPersonaMemoriesToApiMemories(input.structured.persona_memories, {
      now: input.now,
    }),
  };
}

export function buildCreatePersonaPayload(input: {
  structured: PersonaGenerationStructured;
  displayName?: string;
  username?: string;
  now?: Date;
}) {
  const identity = resolvePersonaIdentity(input);
  const base = buildPersonaSavePayloadBase(input);

  return {
    username: identity.username,
    persona: {
      ...input.structured.persona,
      display_name: identity.displayName,
    },
    ...base,
  };
}

export function buildUpdatePersonaPayload(input: {
  structured: PersonaGenerationStructured;
  displayName?: string;
  username?: string;
  now?: Date;
}) {
  const identity = resolvePersonaIdentity(input);
  const base = buildPersonaSavePayloadBase(input);

  return {
    displayName: identity.displayName,
    username: identity.username,
    ...base,
  };
}
