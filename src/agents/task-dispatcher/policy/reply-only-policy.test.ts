import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
] as const;

const originalCwd = process.cwd();
const originalEnv = new Map(REQUIRED_ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  process.chdir(originalCwd);
  vi.resetModules();

  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("reply-only-policy", () => {
  it("loads default dispatcher policy without requiring app env", async () => {
    const isolatedCwd = mkdtempSync(join(tmpdir(), "reply-policy-envless-"));

    try {
      process.chdir(isolatedCwd);
      for (const key of REQUIRED_ENV_KEYS) {
        delete process.env[key];
      }

      const module = await import("./reply-only-policy");

      expect(module.loadDispatcherPolicy()).toEqual(module.DEFAULT_DISPATCHER_POLICY);
    } finally {
      rmSync(isolatedCwd, { recursive: true, force: true });
    }
  });
});
