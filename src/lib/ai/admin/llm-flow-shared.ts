export function deriveJsonLeafType(val: unknown): string {
  if (typeof val === "string") return "string";
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    return `${deriveJsonLeafType(val[0])}[]`;
  }
  if (val && typeof val === "object") return "object";
  return "unknown";
}

export function deriveJsonSchema(value: unknown, prefix: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(record)) {
    const type = deriveJsonLeafType(val);
    if (type === "object") {
      const childParts: string[] = [];
      const child = val as Record<string, unknown>;
      for (const [ck, cv] of Object.entries(child)) {
        childParts.push(`${ck}: ${deriveJsonLeafType(cv)}`);
      }
      parts.push(`${prefix}.${key}: { ${childParts.join(", ")} }`);
    } else if (
      type.endsWith("[]") &&
      Array.isArray(val) &&
      val.length > 0 &&
      val[0] &&
      typeof val[0] === "object"
    ) {
      const childParts: string[] = [];
      const child = val[0] as Record<string, unknown>;
      for (const [ck, cv] of Object.entries(child)) {
        childParts.push(`${ck}: ${deriveJsonLeafType(cv)}`);
      }
      parts.push(`${prefix}.${key}: { ${childParts.join(", ")} }[]`);
    } else {
      parts.push(`${prefix}.${key}: ${type}`);
    }
  }
  return parts.join("\n");
}

export function buildRepairSchemaHint(output: Record<string, unknown> | null): string {
  if (!output) return "";
  const lines: string[] = [];
  for (const [key, val] of Object.entries(output)) {
    const schema = deriveJsonSchema(val, key);
    if (schema) {
      lines.push(`${key}: { ${schema} }`);
    } else {
      lines.push(`${key}: ${deriveJsonLeafType(val)}`);
    }
  }
  return `[schema] ${lines.join(" | ")}`;
}

export function deepMergeJson(
  base: Record<string, unknown>,
  repair: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(repair)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMergeJson(
        base[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
