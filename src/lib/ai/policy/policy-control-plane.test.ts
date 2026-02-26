import { describe, it, expect } from "vitest";
import {
  CachedReplyPolicyProvider,
  diffPolicyDocuments,
  resolveReplyPolicy,
  validatePolicyControlPlaneDocument,
  type PolicyControlPlaneEvent,
  type PolicyControlPlaneEventSink,
  type PolicyRelease,
  type PolicyReleaseStore,
} from "@/lib/ai/policy/policy-control-plane";
import { PolicyControlPlaneReasonCode } from "@/lib/ai/reason-codes";

const FALLBACK_POLICY = {
  replyEnabled: true,
  precheckEnabled: true,
  perPersonaHourlyReplyLimit: 8,
  perPostCooldownSeconds: 180,
  precheckSimilarityThreshold: 0.9,
};

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

class InMemoryPolicyEventSink implements PolicyControlPlaneEventSink {
  public readonly events: PolicyControlPlaneEvent[] = [];

  public async record(event: PolicyControlPlaneEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("resolveReplyPolicy", () => {
  it("merges global -> capability -> persona -> board scope", () => {
    const merged = resolveReplyPolicy({
      fallback: FALLBACK_POLICY,
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

  it("normalizes and clamps boundary values from mixed type input", () => {
    const merged = resolveReplyPolicy({
      fallback: FALLBACK_POLICY,
      scope: { personaId: "persona-1", boardId: "board-1" },
      document: {
        global: {
          perPersonaHourlyReplyLimit: -4,
          perPostCooldownSeconds: 12.8,
          precheckSimilarityThreshold: 7,
        },
        capabilities: {
          reply: {
            precheckSimilarityThreshold: -0.1,
            precheckEnabled: false,
          },
        },
        personas: {
          "persona-1": { perPersonaHourlyReplyLimit: 3.6 },
        },
        boards: {
          "board-1": { precheckSimilarityThreshold: 1.2 },
        },
      },
    });

    expect(merged).toEqual({
      replyEnabled: true,
      precheckEnabled: false,
      perPersonaHourlyReplyLimit: 3,
      perPostCooldownSeconds: 12,
      precheckSimilarityThreshold: 1,
    });
  });

  it("ignores invalid field types and keeps fallback values", () => {
    const merged = resolveReplyPolicy({
      fallback: FALLBACK_POLICY,
      scope: { personaId: "persona-1", boardId: "board-1" },
      document: {
        global: {
          replyEnabled: "false" as unknown as boolean,
          precheckEnabled: null as unknown as boolean,
          perPersonaHourlyReplyLimit: "5" as unknown as number,
        },
        capabilities: {
          reply: {
            perPostCooldownSeconds: "120" as unknown as number,
          },
        },
        personas: {
          "persona-1": {
            precheckSimilarityThreshold: "0.5" as unknown as number,
          },
        },
      },
    });

    expect(merged).toEqual(FALLBACK_POLICY);
  });
});

describe("validatePolicyControlPlaneDocument", () => {
  it("normalizes unknown shapes and reports validation issues", () => {
    const validated = validatePolicyControlPlaneDocument({
      global: { replyEnabled: true, perPersonaHourlyReplyLimit: "x" },
      capabilities: { reply: { precheckEnabled: false }, vote: { any: true } },
      personas: { "persona-1": { perPostCooldownSeconds: 33 }, "persona-2": "invalid" },
      boards: "invalid",
    });

    expect(validated.document).toEqual({
      global: { replyEnabled: true },
      capabilities: { reply: { precheckEnabled: false } },
      personas: { "persona-1": { perPostCooldownSeconds: 33 }, "persona-2": {} },
      boards: {},
    });
    expect(validated.issues.map((issue) => issue.path)).toContain(
      "global.perPersonaHourlyReplyLimit",
    );
    expect(validated.issues.map((issue) => issue.path)).toContain("capabilities.vote");
    expect(validated.issues.map((issue) => issue.path)).toContain("boards");
  });
});

describe("diffPolicyDocuments", () => {
  it("returns flattened field changes between versions", () => {
    const diff = diffPolicyDocuments(
      {
        global: { replyEnabled: true, perPersonaHourlyReplyLimit: 8 },
        capabilities: { reply: { precheckEnabled: true } },
      },
      {
        global: { replyEnabled: false, perPersonaHourlyReplyLimit: 10 },
        capabilities: { reply: { precheckEnabled: false } },
        personas: { "persona-1": { perPostCooldownSeconds: 240 } },
      },
    );

    expect(diff).toEqual([
      { path: "capabilities.reply.precheckEnabled", previous: true, next: false },
      { path: "global.perPersonaHourlyReplyLimit", previous: 8, next: 10 },
      { path: "global.replyEnabled", previous: true, next: false },
      { path: "personas.persona-1.perPostCooldownSeconds", previous: undefined, next: 240 },
    ]);
  });
});

describe("CachedReplyPolicyProvider", () => {
  it("uses TTL cache between reads", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const provider = new CachedReplyPolicyProvider({
      now: () => now.value,
      ttlMs: 30_000,
      fallbackPolicy: FALLBACK_POLICY,
      store: buildStore([
        {
          version: 1,
          isActive: true,
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
      fallbackPolicy: FALLBACK_POLICY,
      store: buildStore([
        {
          version: 1,
          isActive: true,
          createdAt: now.value.toISOString(),
          policy: { global: { perPersonaHourlyReplyLimit: 4 } },
        },
        {
          version: 2,
          isActive: true,
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
      fallbackPolicy: FALLBACK_POLICY,
      store: buildStore([
        {
          version: 1,
          isActive: true,
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

  it("uses fallback policy when no active release is found", async () => {
    const eventSink = new InMemoryPolicyEventSink();
    const provider = new CachedReplyPolicyProvider({
      now: () => new Date("2026-02-25T00:00:00.000Z"),
      ttlMs: 30_000,
      fallbackPolicy: FALLBACK_POLICY,
      eventSink,
      store: buildStore([null]),
    });

    const policy = await provider.getReplyPolicy();

    expect(policy).toEqual(FALLBACK_POLICY);
    expect(provider.getStatus().lastReasonCode).toBe(PolicyControlPlaneReasonCode.fallbackDefault);
    expect(eventSink.events.map((event) => event.reasonCode)).toContain(
      PolicyControlPlaneReasonCode.noActiveRelease,
    );
  });

  it("falls back to default policy on load failure without last-known-good", async () => {
    const eventSink = new InMemoryPolicyEventSink();
    const provider = new CachedReplyPolicyProvider({
      now: () => new Date("2026-02-25T00:00:00.000Z"),
      ttlMs: 30_000,
      fallbackPolicy: FALLBACK_POLICY,
      eventSink,
      store: buildStore([new Error("db unavailable")]),
    });

    const policy = await provider.getReplyPolicy();
    const reasonCodes = eventSink.events.map((event) => event.reasonCode);

    expect(policy).toEqual(FALLBACK_POLICY);
    expect(reasonCodes).toContain(PolicyControlPlaneReasonCode.loadFailed);
    expect(reasonCodes).toContain(PolicyControlPlaneReasonCode.fallbackDefault);
  });

  it("records cache hit and refresh observability events", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const eventSink = new InMemoryPolicyEventSink();
    const provider = new CachedReplyPolicyProvider({
      now: () => now.value,
      ttlMs: 30_000,
      fallbackPolicy: FALLBACK_POLICY,
      eventSink,
      store: buildStore([
        {
          version: 1,
          isActive: true,
          createdAt: now.value.toISOString(),
          policy: { global: { perPersonaHourlyReplyLimit: 6 } },
        },
      ]),
    });

    await provider.getReplyPolicy();
    await provider.getReplyPolicy();

    expect(eventSink.events.map((event) => event.reasonCode)).toContain(
      PolicyControlPlaneReasonCode.cacheRefresh,
    );
    expect(eventSink.events.map((event) => event.reasonCode)).toContain(
      PolicyControlPlaneReasonCode.cacheHit,
    );
  });
});
