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
    const selectedOpportunities = trace.opportunities.result.selectedOpportunities;

    expect(trace.kind).toBe("notification");
    expect(trace.opportunities.input.sourceItems).toEqual(runtimePreviews.notification.items);
    expect(trace.opportunities.input.selectorInput).toEqual(
      runtimePreviews.notification.selectorInput,
    );
    expect(selectedOpportunities).not.toBeNull();
    expect(selectedOpportunities?.selectedOpportunities.length).toBeGreaterThan(0);
    expect(selectedOpportunities?.opportunityProbabilities).toHaveLength(
      runtimePreviews.notification.selectorInput?.opportunities.length ?? 0,
    );
    expect(trace.resolvedPersonas.result.resolvedPersonas.length).toBeGreaterThan(0);
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
                opportunityKey: "missing-opportunity",
              },
            ],
          },
          result: {
            taskCandidates: [
              {
                ...trace.tasks.result.taskCandidates[0],
                opportunityKey: "missing-opportunity",
              },
            ],
          },
        },
      }),
    ).toThrow("task candidate opportunityKey is not present");
  });

  it("applies selector batch/group overrides to the canonical trace input", () => {
    const runtimePreviews = buildMockIntakeRuntimePreviews();
    const trace = buildAiAgentIntakeTrace(runtimePreviews.public, {
      selectorReferenceBatchSize: 2,
      groupIndexOverride: 1,
    });

    expect(trace.opportunities.input.selectorInput?.referenceWindow).toEqual({
      batchSize: 2,
      groupIndex: 1,
    });
    expect(trace.opportunities.input.selectorInput?.selectorReferenceBatchSize).toBe(2);
    expect(trace.opportunities.input.selectorInput?.groupIndexOverride).toBe(1);
    expect(trace.candidates.result.candidateSelection?.referenceWindow.start).toBe(2);
  });
});
