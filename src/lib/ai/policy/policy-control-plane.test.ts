import { describe, it, expect } from "vitest";
import {
  CachedReplyPolicyProvider,
  resolveReplyPolicy,
  type PolicyRelease,
  type PolicyReleaseStore,
} from "@/lib/ai/policy/policy-control-plane";

function buildStore(releases: Array<PolicyRelease | Error | null>): PolicyReleaseStore {
  let cursor = 0;
  return {
    async fetchLatestActive() {
      const next = releases[cursor] ?? releases[releases.length - 1] ?? null;
      cursor += 1;
      if (next instanceof Error) {
        throw next;
      }
      return next ?? null;
    },
  };
}

describe("resolveReplyPolicy", () => {
  it("merges global -> capability -> persona -> board scope", () => {
    const merged = resolveReplyPolicy({
      fallback: {
        replyEnabled: true,
        precheckEnabled: true,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      scope: { personaId: "persona-1", boardId: "board-1" },
      document: {
        global: { perPersonaHourlyReplyLimit: 5 },
        capabilities: { reply: { precheckEnabled: false, perPostCooldownSeconds: 120 } },
        personas: { "persona-1": { perPersonaHourlyReplyLimit: 2 } },
        boards: { "board-1": { precheckSimilarityThreshold: 0.8 } },
      },
    });

    expect(merged).toEqual({
      replyEnabled: true,
      precheckEnabled: false,
      perPersonaHourlyReplyLimit: 2,
      perPostCooldownSeconds: 120,
      precheckSimilarityThreshold: 0.8,
    });
  });
});

describe("CachedReplyPolicyProvider", () => {
  it("uses TTL cache between reads", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const provider = new CachedReplyPolicyProvider({
      now: () => now.value,
      ttlMs: 30_000,
      fallbackPolicy: {
        replyEnabled: true,
        precheckEnabled: true,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      store: buildStore([
        {
          version: 1,
          createdAt: now.value.toISOString(),
          policy: { global: { perPersonaHourlyReplyLimit: 4 } },
        },
      ]),
    });

    const first = await provider.getReplyPolicy();
    const second = await provider.getReplyPolicy();

    expect(first.perPersonaHourlyReplyLimit).toBe(4);
    expect(second.perPersonaHourlyReplyLimit).toBe(4);
  });

  it("refreshes after TTL expiry", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const provider = new CachedReplyPolicyProvider({
      now: () => now.value,
      ttlMs: 30_000,
      fallbackPolicy: {
        replyEnabled: true,
        precheckEnabled: true,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      store: buildStore([
        {
          version: 1,
          createdAt: now.value.toISOString(),
          policy: { global: { perPersonaHourlyReplyLimit: 4 } },
        },
        {
          version: 2,
          createdAt: now.value.toISOString(),
          policy: { global: { perPersonaHourlyReplyLimit: 7 } },
        },
      ]),
    });

    const first = await provider.getReplyPolicy();
    now.value = new Date("2026-02-25T00:01:00.000Z");
    const second = await provider.getReplyPolicy();

    expect(first.perPersonaHourlyReplyLimit).toBe(4);
    expect(second.perPersonaHourlyReplyLimit).toBe(7);
  });

  it("falls back to last known good when DB read fails", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const provider = new CachedReplyPolicyProvider({
      now: () => now.value,
      ttlMs: 10_000,
      fallbackPolicy: {
        replyEnabled: true,
        precheckEnabled: true,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      store: buildStore([
        {
          version: 1,
          createdAt: now.value.toISOString(),
          policy: { global: { precheckEnabled: false } },
        },
        new Error("db unavailable"),
      ]),
    });

    const first = await provider.getReplyPolicy();
    now.value = new Date("2026-02-25T00:00:20.000Z");
    const second = await provider.getReplyPolicy();

    expect(first.precheckEnabled).toBe(false);
    expect(second.precheckEnabled).toBe(false);
  });
});
