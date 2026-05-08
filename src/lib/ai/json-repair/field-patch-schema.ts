import { z } from "zod";

const FieldPatchOperationSchema = z.object({
  path: z.string(),
  value: z.unknown(),
});

export const FieldPatchRepairSchema = z.object({
  repair: z.array(FieldPatchOperationSchema).min(1).max(20),
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

    if (path.includes("__proto__") || path === "prototype" || path === "constructor") {
      rejected.push({ path, reason: "prototype pollution" });
      continue;
    }

    const isAllowed = allowedPaths.some((allowed) => matchesAllowedPath(path, allowed));
    if (!isAllowed) {
      rejected.push({ path, reason: `not in allowed repair paths` });
      continue;
    }

    const isImmutable = immutablePaths.some(
      (immutable) => path === immutable || path.startsWith(`${immutable}.`),
    );
    if (isImmutable) {
      rejected.push({ path, reason: `immutable path` });
      continue;
    }

    const parts = path.split(".");
    let target: Record<string, unknown> = merged;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (key === "*") continue;
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    const lastKey = parts[parts.length - 1];
    target[lastKey] = op.value;
  }

  return { merged, rejected };
}
