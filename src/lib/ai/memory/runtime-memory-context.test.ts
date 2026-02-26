import { describe, expect, it, vi } from "vitest";
import {
  buildSafetyMemoryHints,
  CachedRuntimeMemoryProvider,
  InMemoryRuntimeMemoryEventSink,
  type RuntimeMemoryContext,
} from "@/lib/ai/memory/runtime-memory-context";
import { MemoryReasonCode } from "@/lib/ai/reason-codes";

describe("CachedRuntimeMemoryProvider", () => {
  it("uses TTL cache and refreshes after expiry", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const getPolicyRefs = vi
      .fn()
      .mockResolvedValueOnce({ policyVersion: 1 })
      .mockResolvedValueOnce({ policyVersion: 2 });
    const getMemoryRefs = vi.fn().mockResolvedValue({
      communityMemoryVersion: "c1",
      safetyMemoryVersion: "s1",
    });

    const provider = new CachedRuntimeMemoryProvider({
      now: () => now.value,
      ttlMs: 10_000,
      deps: {
        getPolicyRefs,
        getMemoryRefs,
        getPersonaCanonicalLongMemory: async () => null,
        getThreadShortMemoryEntries: async () => [],
      },
    });

    const first = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
    });
    const second = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
    });

    now.value = new Date("2026-02-25T00:00:12.000Z");
    const third = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
    });

    expect(first.policyRefs.policyVersion).toBe(1);
    expect(second.policyRefs.policyVersion).toBe(1);
    expect(third.policyRefs.policyVersion).toBe(2);
    expect(getPolicyRefs).toHaveBeenCalledTimes(2);
  });

  it("falls back to last-known-good global/persona when DB read fails", async () => {
    const now = { value: new Date("2026-02-25T00:00:00.000Z") };
    const eventSink = new InMemoryRuntimeMemoryEventSink();
    const provider = new CachedRuntimeMemoryProvider({
      now: () => now.value,
      ttlMs: 5_000,
      deps: {
        getPolicyRefs: vi
          .fn()
          .mockResolvedValueOnce({ policyVersion: 10 })
          .mockRejectedValueOnce(new Error("policy db down")),
        getMemoryRefs: vi
          .fn()
          .mockResolvedValueOnce({ communityMemoryVersion: "c1", safetyMemoryVersion: "s1" })
          .mockRejectedValueOnce(new Error("memory refs db down")),
        getPersonaCanonicalLongMemory: vi
          .fn()
          .mockResolvedValueOnce({
            id: "p1",
            content: "persona canonical memory",
            updatedAt: "2026-02-24T12:00:00.000Z",
          })
          .mockRejectedValueOnce(new Error("persona db down")),
        getThreadShortMemoryEntries: async () => [],
        eventSink,
      },
    });

    const first = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      taskType: "reply",
    });

    now.value = new Date("2026-02-25T00:00:10.000Z");
    const second = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      taskType: "reply",
    });

    expect(first.policyRefs.policyVersion).toBe(10);
    expect(second.policyRefs.policyVersion).toBe(10);
    expect(second.memoryRefs.communityMemoryVersion).toBe("c1");
    expect(second.personaLongMemory?.content).toContain("canonical");
    expect(
      eventSink.events.some((event) => event.reasonCode === MemoryReasonCode.fallbackLastKnownGood),
    ).toBe(true);
  });

  it("normalizes invalid schema and keeps flow running in tolerateFailure mode", async () => {
    const provider = new CachedRuntimeMemoryProvider({
      deps: {
        getPolicyRefs: async () => ({ policyVersion: "not-number" }),
        getMemoryRefs: async () => ({ communityMemoryVersion: 123, safetyMemoryVersion: "  " }),
        getPersonaCanonicalLongMemory: async () => ({
          id: null,
          content: 99,
          updatedAt: "invalid",
        }),
        getThreadShortMemoryEntries: async () => [
          {
            id: "t1",
            key: "k1",
            value: "ok",
            metadata: {},
            ttlSeconds: "bad",
            maxItems: 10,
            expiresAt: "2026-02-26T00:00:00.000Z",
            updatedAt: "2026-02-25T00:00:00.000Z",
          },
        ],
      },
    });

    const context = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
      now: new Date("2026-02-25T10:00:00.000Z"),
      tolerateFailure: true,
    });

    expect(context.policyRefs.policyVersion).toBeNull();
    expect(context.memoryRefs.communityMemoryVersion).toBeNull();
    expect(context.personaLongMemory).toBeNull();
    expect(context.threadShortMemory.entries).toHaveLength(0);
  });

  it("applies thread governance trim, cap, and dedupe", async () => {
    const provider = new CachedRuntimeMemoryProvider({
      governance: {
        threadMaxItems: 2,
        dedupe: { enabled: true, minValueLength: 6 },
      },
      deps: {
        getPolicyRefs: async () => ({ policyVersion: 1 }),
        getMemoryRefs: async () => ({ communityMemoryVersion: "c1", safetyMemoryVersion: "s1" }),
        getPersonaCanonicalLongMemory: async () => ({
          id: "p1",
          content: "one two three four five six seven eight nine ten",
          updatedAt: "2026-02-25T00:00:00.000Z",
        }),
        getThreadShortMemoryEntries: async () => [
          {
            id: "m1",
            key: "k1",
            value: "same memory text",
            metadata: {},
            ttlSeconds: 3600,
            maxItems: 10,
            expiresAt: "2026-02-25T03:00:00.000Z",
            updatedAt: "2026-02-25T02:59:00.000Z",
          },
          {
            id: "m2",
            key: "k2",
            value: "same memory text",
            metadata: {},
            ttlSeconds: 3600,
            maxItems: 10,
            expiresAt: "2026-02-25T03:00:00.000Z",
            updatedAt: "2026-02-25T02:58:00.000Z",
          },
          {
            id: "m3",
            key: "k3",
            value: "tiny",
            metadata: {},
            ttlSeconds: 3600,
            maxItems: 10,
            expiresAt: "2026-02-25T03:00:00.000Z",
            updatedAt: "2026-02-25T02:57:00.000Z",
          },
          {
            id: "m4",
            key: "k4",
            value: "another useful memory",
            metadata: {},
            ttlSeconds: 3600,
            maxItems: 10,
            expiresAt: "2026-02-25T03:00:00.000Z",
            updatedAt: "2026-02-25T02:56:00.000Z",
          },
        ],
      },
    });

    const context = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
      now: new Date("2026-02-25T02:59:30.000Z"),
      threadWindowSeconds: 3600,
    });

    expect(context.threadShortMemory.entries).toHaveLength(2);
    expect(context.threadShortMemory.entries.map((entry) => entry.id)).toEqual(["m1", "m4"]);
  });

  it("does not block when thread read fails", async () => {
    const eventSink = new InMemoryRuntimeMemoryEventSink();
    const provider = new CachedRuntimeMemoryProvider({
      deps: {
        getPolicyRefs: async () => ({ policyVersion: 1 }),
        getMemoryRefs: async () => ({ communityMemoryVersion: "c1", safetyMemoryVersion: "s1" }),
        getPersonaCanonicalLongMemory: async () => null,
        getThreadShortMemoryEntries: async () => {
          throw new Error("thread read error");
        },
        eventSink,
      },
    });

    const context = await provider.getRuntimeMemoryContext({
      personaId: "persona-1",
      threadId: "thread-1",
      taskType: "reply",
      now: new Date("2026-02-25T02:59:30.000Z"),
    });

    expect(context.policyRefs.policyVersion).toBe(1);
    expect(context.threadShortMemory.entries).toHaveLength(0);
    expect(
      eventSink.events.some(
        (event) => event.layer === "thread" && event.reasonCode === MemoryReasonCode.threadMissing,
      ),
    ).toBe(true);
  });
});

describe("buildSafetyMemoryHints", () => {
  it("merges memory hints in thread -> persona -> refs order with dedupe", () => {
    const context: RuntimeMemoryContext = {
      policyRefs: {
        policyVersion: 11,
      },
      memoryRefs: {
        communityMemoryVersion: "community-v3",
        safetyMemoryVersion: "safety-v5",
      },
      personaLongMemory: {
        id: "long-1",
        content: "Remember to compare assumptions before a recommendation.",
        updatedAt: "2026-02-25T00:00:00.000Z",
      },
      threadShortMemory: {
        threadId: "thread-1",
        boardId: "board-1",
        taskType: "reply",
        ttlSeconds: 172800,
        maxItems: 10,
        entries: [
          {
            id: "m1",
            key: "latest",
            value: "Use concrete trade-offs.",
            metadata: {},
            ttlSeconds: 172800,
            maxItems: 10,
            expiresAt: "2026-02-27T00:00:00.000Z",
            updatedAt: "2026-02-25T10:00:00.000Z",
          },
          {
            id: "m2",
            key: "dup",
            value: "Use concrete trade-offs.",
            metadata: {},
            ttlSeconds: 172800,
            maxItems: 10,
            expiresAt: "2026-02-27T00:00:00.000Z",
            updatedAt: "2026-02-25T09:00:00.000Z",
          },
        ],
      },
    };

    const hints = buildSafetyMemoryHints({
      context,
      existingHints: ["Existing prior hint"],
      maxItems: 6,
    });

    expect(hints[0]).toBe("Use concrete trade-offs.");
    expect(hints[1]).toContain("Remember to compare assumptions");
    expect(hints.join(" | ")).toContain("policy:v11");
    expect(hints).toContain("Existing prior hint");
    expect(hints.filter((hint) => hint === "Use concrete trade-offs.")).toHaveLength(1);
  });
});
