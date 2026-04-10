import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-contract";
import { derivePersonaUsername, normalizeUsernameInput } from "@/lib/username-validation";

type PersonaSavePayloadBase = {
  bio: string;
  personaCore: Record<string, unknown>;
  referenceSources: PersonaGenerationStructured["reference_sources"];
  otherReferenceSources: PersonaGenerationStructured["other_reference_sources"];
  referenceDerivation: string[];
  originalizationNote: string;
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

function buildPersonaSavePayloadBase(input: {
  structured: PersonaGenerationStructured;
}): PersonaSavePayloadBase {
  return {
    bio: input.structured.persona.bio,
    personaCore: input.structured.persona_core,
    referenceSources: input.structured.reference_sources,
    otherReferenceSources: input.structured.other_reference_sources,
    referenceDerivation: input.structured.reference_derivation,
    originalizationNote: input.structured.originalization_note,
  };
}

export function buildCreatePersonaPayload(input: {
  structured: PersonaGenerationStructured;
  displayName?: string;
  username?: string;
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
}) {
  const identity = resolvePersonaIdentity(input);
  const base = buildPersonaSavePayloadBase(input);

  return {
    displayName: identity.displayName,
    username: identity.username,
    ...base,
  };
}
