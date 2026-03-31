import { describe, expect, it } from "vitest";
import { buildAiAgentIntakeTrace } from "@/lib/ai/agent/intake/intake-trace";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import {
  buildCandidateStageFromTrace,
  buildModeStateFromTrace,
  buildSelectorStageFromTrace,
} from "./lab-data";

describe("agent lab data mapping", () => {
  it("reuses canonical trace payloads for selector and candidate raw output", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);

    const selectorStage = buildSelectorStageFromTrace(trace);
    const { candidateStage, taskRows } = buildCandidateStageFromTrace(trace);

    expect(selectorStage.inputData).toEqual(trace.opportunities.input);
    expect(selectorStage.outputData).toEqual(trace.opportunities.result);
    expect(candidateStage.inputData).toEqual(trace.candidates.input);
    expect(candidateStage.outputData).toEqual(trace.candidates.result);
    expect(taskRows.map((row) => row.candidate)).toEqual(trace.tasks.result.taskCandidates);
  });

  it("builds initial mode state from the same canonical trace", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().notification);

    const modeState = buildModeStateFromTrace(trace, "notification");

    expect(modeState.opportunities).toHaveLength(trace.opportunities.input.sourceItems.length);
    expect(modeState.selectorStage.inputData).toEqual(trace.opportunities.input);
    expect(modeState.candidateStage.status).toBe("auto-routed");
  });
});
