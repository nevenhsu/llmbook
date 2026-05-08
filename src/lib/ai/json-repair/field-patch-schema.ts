import { z } from "zod";

const FieldPatchOperationSchema = z.object({
  path: z.string().min(1),
  value: z.unknown(),
});

export const FieldPatchRepairSchema = z.object({
  repair: z.array(FieldPatchOperationSchema).min(1).max(20),
});

export const FinishContinuationSchema = z.object({
  suffix: z.string().default(""),
  completed_fragment: z.unknown().optional(),
});

export function matchesAllowedPath(failingPath: string, allowedPattern: string): boolean {
  const failingParts = failingPath.split(".");
  const allowedParts = allowedPattern.split(".");

  if (failingParts.length !== allowedParts.length) return false;

  for (let i = 0; i < allowedParts.length; i++) {
    if (allowedParts[i] === "*") continue;
    if (allowedParts[i] !== failingParts[i]) return false;
  }

  return true;
}

function zodInnerDef(schema: z.ZodTypeAny): Record<string, unknown> | null {
  return (schema as unknown as Record<string, unknown>)?._def as Record<string, unknown> | null;
}

function zodInnerShape(def: Record<string, unknown> | null): Record<string, z.ZodTypeAny> | null {
  if (!def) return null;
  const shape = def.shape;
  if (!shape) return null;
  if (typeof shape === "function") {
    return (shape as () => Record<string, z.ZodTypeAny>)() ?? null;
  }
  return shape as Record<string, z.ZodTypeAny> | null;
}

function inferLeafSchema(rootSchema: z.ZodTypeAny, path: string): z.ZodTypeAny | null {
  const parts = path.split(".");
  let current: z.ZodTypeAny = rootSchema;

  for (const part of parts) {
    if (part === "*") continue;

    const def = zodInnerDef(current);
    const shape = zodInnerShape(def);
    if (!shape) return null;

    const field = shape[part];
    if (!field) return null;

    current = field;
  }

  return current;
}

export function buildFieldPatchSchema(input: {
  rootSchema: z.ZodTypeAny;
  repairablePaths: string[];
}): z.ZodTypeAny {
  return FieldPatchRepairSchema;
}

function isPollutionSegment(segment: string): boolean {
  const lower = segment.toLowerCase();
  return lower === "__proto__" || lower === "prototype" || lower === "constructor";
}

function isArrayIndex(segment: string): boolean {
  return /^(0|[1-9]\d*)$/.test(segment);
}

export function applyFieldPatch(
  original: Record<string, unknown>,
  patchOps: Array<{ path: string; value: unknown }>,
  allowedPaths: string[],
  immutablePaths: string[],
): { merged: Record<string, unknown>; rejected: Array<{ path: string; reason: string }> } {
  const merged = JSON.parse(JSON.stringify(original));
  const rejected: Array<{ path: string; reason: string }> = [];

  for (const op of patchOps) {
    const path = op.path;

    // Check every segment for prototype pollution
    const segments = path.split(".");
    if (segments.some((seg) => isPollutionSegment(seg))) {
      rejected.push({ path, reason: "prototype pollution" });
      continue;
    }
    if (segments.some((seg) => seg === "*")) {
      rejected.push({ path, reason: "wildcard write path" });
      continue;
    }

    // Check path is allowed
    const isAllowed = allowedPaths.some((allowed) => matchesAllowedPath(path, allowed));
    if (!isAllowed) {
      rejected.push({ path, reason: "not in allowed repair paths" });
      continue;
    }

    // Check path is not immutable
    const isImmutable = immutablePaths.some(
      (immutable) => path === immutable || path.startsWith(`${immutable}.`),
    );
    if (isImmutable) {
      rejected.push({ path, reason: "immutable path" });
      continue;
    }

    // Navigate to target, creating intermediate objects as needed
    const parts = path.split(".");
    let target: Record<string, unknown> | unknown[] = merged;
    let rejectedPath = false;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const nextKey = parts[i + 1];

      if (Array.isArray(target)) {
        if (!isArrayIndex(key)) {
          rejected.push({ path, reason: "non-numeric array path segment" });
          rejectedPath = true;
          break;
        }
        const index = Number(key);
        if (!target[index] || typeof target[index] !== "object") {
          target[index] = isArrayIndex(nextKey) ? [] : {};
        }
        target = target[index] as Record<string, unknown> | unknown[];
        continue;
      }

      if (!target[key] || typeof target[key] !== "object") {
        target[key] = isArrayIndex(nextKey) ? [] : {};
      }
      target = target[key] as Record<string, unknown> | unknown[];
    }
    if (rejectedPath) {
      continue;
    }
    const lastKey = parts[parts.length - 1];
    if (Array.isArray(target)) {
      if (!isArrayIndex(lastKey)) {
        rejected.push({ path, reason: "non-numeric array path segment" });
        continue;
      }
      target[Number(lastKey)] = op.value;
    } else {
      if (isPollutionSegment(lastKey)) {
        rejected.push({ path, reason: "prototype pollution" });
        continue;
      }
      target[lastKey] = op.value;
    }
  }

  return { merged, rejected };
}
