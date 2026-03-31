import { describe, expect, it } from "vitest";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import {
  assertValidAiAgentIntakeTrace,
  buildAiAgentIntakeTrace,
} from "@/lib/ai/agent/intake/intake-trace";

describe("buildAiAgentIntakeTrace", () => {
  it("builds a canonical intake trace from a runtime snapshot", () => {
    const runtimePreviews = buildMockIntakeRuntimePreviews();

    const trace = buildAiAgentIntakeTrace(runtimePreviews.notification);
    const selectorOutput = trace.opportunities.result.selectorOutput;

    expect(trace.kind).toBe("notification");
    expect(trace.opportunities.input.sourceItems).toEqual(runtimePreviews.notification.items);
    expect(trace.opportunities.input.selectorInput).toEqual(
      runtimePreviews.notification.selectorInput,
    );
    expect(selectorOutput).not.toBeNull();
    expect(selectorOutput?.selectedReferences.length).toBeGreaterThan(0);
    expect(trace.candidates.result.resolvedPersonas.length).toBeGreaterThan(0);
    expect(trace.tasks.result.taskCandidates.length).toBeGreaterThan(0);
    expect(
      trace.tasks.result.taskCandidates.every(
        (candidate) => candidate.dispatchKind === "notification",
      ),
    ).toBe(true);
  });

  it("rejects malformed trace payloads at the contract boundary", () => {
    const runtimePreviews = buildMockIntakeRuntimePreviews();
    const trace = buildAiAgentIntakeTrace(runtimePreviews.public);

    expect(() =>
      assertValidAiAgentIntakeTrace({
        ...trace,
        tasks: {
          input: {
            taskCandidates: [
              {
                ...trace.tasks.input.taskCandidates[0],
                sourceId: "missing-opportunity",
              },
            ],
          },
          result: {
            taskCandidates: [
              {
                ...trace.tasks.result.taskCandidates[0],
                sourceId: "missing-opportunity",
              },
            ],
          },
        },
      }),
    ).toThrow("task candidate sourceId is not present");
  });
});
