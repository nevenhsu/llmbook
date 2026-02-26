import { describe, expect, it, vi } from "vitest";
import {
  buildSafetyMemoryHints,
  createRuntimeMemoryContextBuilder,
  type RuntimeMemoryContext,
} from "@/lib/ai/memory/runtime-memory-context";

describe("buildRuntimeMemoryContext", () => {
  it("filters expired thread memories by TTL and window", async () => {
    const builder = createRuntimeMemoryContextBuilder({
      getGlobalPolicyRefs: async () => ({
        policyVersion: 7,
        communityMemoryVersion: "c1",
        safetyMemoryVersion: "s1",
      }),
      getPersonaCanonicalLongMemory: async () => ({
        id: "long-1",
        content: "persona canonical memory",
        updatedAt: "2026-02-24T12:00:00.000Z",
      }),
      getThreadShortMemoryEntries: async () => [
        {
          id: "active-recent",
          key: "k1",
          value: "fresh memory",
          metadata: {},
          ttlSeconds: 3600,
          maxItems: 5,
          expiresAt: "2026-02-25T01:00:00.000Z",
          updatedAt: "2026-02-25T00:40:00.000Z",
        },
        {
          id: "expired",
          key: "k2",
          value: "expired memory",
          metadata: {},
          ttlSeconds: 3600,
          maxItems: 5,
          expiresAt: "2026-02-25T00:00:00.000Z",
          updatedAt: "2026-02-24T23:30:00.000Z",
        },
        {
          id: "outside-window",
          key: "k3",
          value: "too old for window",
          metadata: {},
          ttlSeconds: 3600,
          maxItems: 5,
          expiresAt: "2026-02-25T02:00:00.000Z",
          updatedAt: "2026-02-24T20:00:00.000Z",
        },
      ],
    });

    const context = await builder({
      personaId: "persona-1",
      threadId: "thread-1",
      boardId: "board-1",
      taskType: "reply",
      now: new Date("2026-02-25T00:50:00.000Z"),
      threadWindowSeconds: 60 * 60,
    });

    expect(context.threadShortMemory.entries).toHaveLength(1);
    expect(context.threadShortMemory.entries[0]?.id).toBe("active-recent");
  });
});

describe("buildSafetyMemoryHints", () => {
  it("merges memory hints in thread > persona > global order with dedupe", () => {
    const context: RuntimeMemoryContext = {
      globalPolicyRefs: {
        policyVersion: 11,
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

describe("precheck memory fallback", () => {
  it("keeps flow running when memory read fails", async () => {
    const onFallback = vi.fn();
    const builder = createRuntimeMemoryContextBuilder({
      getGlobalPolicyRefs: async () => {
        throw new Error("db unavailable");
      },
      getPersonaCanonicalLongMemory: async () => null,
      getThreadShortMemoryEntries: async () => [],
      onFallback,
    });

    const context = await builder({
      personaId: "persona-1",
      taskType: "reply",
      now: new Date("2026-02-25T00:00:00.000Z"),
      tolerateFailure: true,
    });

    expect(context.personaLongMemory).toBeNull();
    expect(context.threadShortMemory.entries).toHaveLength(0);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
});
