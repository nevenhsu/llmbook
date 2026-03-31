"use client";

import { useMemo, useState } from "react";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import { AiAgentLabSurface } from "./AiAgentLabSurface";
import {
  buildCandidateStage,
  buildEmptyModeState,
  buildInitialModes,
  buildSelectorStage,
  filterLabModels,
} from "./lab-data";
import type { AgentLabSaveTaskOutcome, AgentLabSourceMode } from "./types";

type PreviewMockState = "default" | "empty" | "error";

type PreviewResults = {
  default: {
    saveOutcomes: Record<AgentLabSourceMode, Record<string, AgentLabSaveTaskOutcome>>;
  };
  error: {
    selectorErrors: Record<AgentLabSourceMode, string>;
    candidateErrors: Record<AgentLabSourceMode, string>;
    saveOutcomes: Record<AgentLabSourceMode, Record<string, AgentLabSaveTaskOutcome>>;
  };
};

const PREVIEW_TOTAL_PERSONA_REFERENCE_COUNT = 120;
const PREVIEW_DEFAULT_PERSONA_BATCH_SIZE = 10;

type Props = {
  runtimePreviews: {
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  };
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  results: PreviewResults;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildFallbackSaveOutcome(sourceMode: AgentLabSourceMode, candidateIndex: number) {
  return {
    inserted: true,
    skipReason: null,
    taskId: `mock-task-${sourceMode}-${candidateIndex + 1}`,
    errorMessage: null,
    status: "PENDING",
  } satisfies AgentLabSaveTaskOutcome;
}

function applyPreviewPersonaReferenceCount(
  modes: ReturnType<typeof buildInitialModes>,
): ReturnType<typeof buildInitialModes> {
  const patchMode = (mode: (typeof modes)[AgentLabSourceMode]) => {
    const maxGroupIndex = Math.max(
      0,
      Math.ceil(PREVIEW_TOTAL_PERSONA_REFERENCE_COUNT / PREVIEW_DEFAULT_PERSONA_BATCH_SIZE) - 1,
    );
    const nextGroupIndex = Math.min(Math.max(mode.personaGroup.groupIndex, 0), maxGroupIndex);
    return {
      ...mode,
      personaGroup: {
        ...mode.personaGroup,
        totalReferenceCount: PREVIEW_TOTAL_PERSONA_REFERENCE_COUNT,
        batchSize: PREVIEW_DEFAULT_PERSONA_BATCH_SIZE,
        groupIndex: nextGroupIndex,
        maxGroupIndex,
      },
    };
  };

  return {
    public: patchMode(modes.public),
    notification: patchMode(modes.notification),
  };
}

export function PreviewAiAgentLabClient({ runtimePreviews, models, providers, results }: Props) {
  const [mockState, setMockState] = useState<PreviewMockState>("default");
  const labModels = useMemo(() => filterLabModels(models), [models]);
  const initialModes = useMemo(() => {
    if (mockState === "empty") {
      return {
        public: buildEmptyModeState("public"),
        notification: buildEmptyModeState("notification"),
      };
    }

    return applyPreviewPersonaReferenceCount(buildInitialModes(runtimePreviews));
  }, [mockState, runtimePreviews]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Mock State
        </span>
        <div className="flex gap-2">
          {(["default", "empty", "error"] as const).map((state) => (
            <button
              key={state}
              type="button"
              className={`btn btn-sm ${mockState === state ? "btn-neutral" : "btn-outline"}`}
              onClick={() => setMockState(state)}
            >
              {state[0].toUpperCase()}
              {state.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <AiAgentLabSurface
        key={mockState}
        dataSource="mock"
        titleEyebrow="Preview"
        title="AI Agent Lab"
        description="Mock-backed lab surface that mirrors admin runtime UX, including selector, candidate, and save flows."
        sourceModeOptions={[
          { value: "public", label: "Public Preview" },
          { value: "notification", label: "Notification Preview" },
        ]}
        initialSourceMode="public"
        models={labModels}
        providers={providers}
        initialModelId={labModels[0]?.id ?? ""}
        initialModes={initialModes}
        onRunSelector={async ({ sourceMode }) => {
          await wait(150);
          if (mockState === "empty") {
            return buildSelectorStage({
              snapshot: null,
              status: "error",
              errorMessage: "No opportunities available.",
            });
          }

          if (mockState === "error") {
            return buildSelectorStage({
              snapshot: runtimePreviews[sourceMode],
              status: "error",
              errorMessage: results.error.selectorErrors[sourceMode],
            });
          }

          return buildSelectorStage({
            snapshot: runtimePreviews[sourceMode],
          });
        }}
        onRunCandidate={async ({ sourceMode }) => {
          await wait(150);
          if (mockState === "empty") {
            return {
              candidateStage: {
                status: sourceMode === "notification" ? "auto-routed" : "error",
                prompt: null,
                inputData: null,
                outputData: {
                  error: "No selector input available.",
                },
                selectedReferences: [],
                rows: [],
              },
              taskRows: [],
            };
          }

          if (mockState === "error") {
            return buildCandidateStage({
              kind: sourceMode,
              snapshot: runtimePreviews[sourceMode],
              status: sourceMode === "notification" ? "auto-routed" : "error",
              errorMessage: results.error.candidateErrors[sourceMode],
            });
          }

          return buildCandidateStage({
            kind: sourceMode,
            snapshot: runtimePreviews[sourceMode],
          });
        }}
        onSaveTask={async ({ sourceMode, row }) => {
          await wait(150);
          if (!row.candidate) {
            throw new Error("Task row is missing candidate payload.");
          }

          if (mockState === "empty") {
            return {
              inserted: false,
              skipReason: "empty_state",
              taskId: null,
              errorMessage: "No mock task available to save.",
              status: "FAILED",
            };
          }

          const candidateKey = String(row.candidate.candidateIndex);
          const outcome =
            (mockState === "error"
              ? results.error.saveOutcomes[sourceMode][candidateKey]
              : results.default.saveOutcomes[sourceMode][candidateKey]) ??
            buildFallbackSaveOutcome(sourceMode, row.candidate.candidateIndex);

          return outcome;
        }}
      />
    </div>
  );
}
