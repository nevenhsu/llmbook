export function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function extractJsonFromText(text: string): string {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

export function parseJsonObject(
  text: string,
  errorFactory: (type: "empty" | "invalid_json" | "invalid_shape") => Error,
): Record<string, unknown> {
  const jsonText = extractJsonFromText(text);
  if (!jsonText) {
    throw errorFactory("empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw errorFactory("invalid_json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw errorFactory("invalid_shape");
  }

  return parsed as Record<string, unknown>;
}

export function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter((item) => item.length > 0);
}

export function readCheckStatus(value: unknown): "pass" | "fail" | null {
  return value === "pass" || value === "fail" ? value : null;
}
