import { transliterate } from "transliteration";

export function normalizePersonaReferenceName(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function buildPersonaReferenceRomanizedName(value: string): string {
  const normalized = normalizePersonaReferenceName(value);
  if (!normalized) {
    return "";
  }

  return transliterate(normalized)
    .replace(/[^A-Za-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function buildPersonaReferenceMatchKey(value: string): string {
  return buildPersonaReferenceRomanizedName(value).toLowerCase().replace(/\s+/gu, "");
}

export function buildPersonaReferenceRow(input: { personaId: string; sourceName: string }) {
  const sourceName = normalizePersonaReferenceName(input.sourceName);
  const normalizedName = sourceName.toLowerCase();
  const romanizedName = buildPersonaReferenceRomanizedName(sourceName);
  const matchKey = buildPersonaReferenceMatchKey(sourceName);

  return {
    persona_id: input.personaId,
    source_name: sourceName,
    normalized_name: normalizedName,
    romanized_name: romanizedName,
    match_key: matchKey,
  };
}
