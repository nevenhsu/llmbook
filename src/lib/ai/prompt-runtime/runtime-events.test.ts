import { describe, expect, it } from "vitest";
import { PromptRuntimeEventRecorder } from "@/lib/ai/prompt-runtime/runtime-events";

describe("PromptRuntimeEventRecorder", () => {
  it("does not throw when sink record fails", async () => {
    const recorder = new PromptRuntimeEventRecorder({
      sink: {
        record: async () => {
          throw new Error("db down");
        },
      },
    });

    await expect(
      recorder.record({
        layer: "provider_runtime",
        operation: "CALL",
        reasonCode: "PROVIDER_CALL_FAILED",
        entityId: "task-1",
        occurredAt: "2026-02-26T00:00:00.000Z",
      }),
    ).resolves.toBeUndefined();
  });
});
