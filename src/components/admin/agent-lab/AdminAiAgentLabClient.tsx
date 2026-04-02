"use client";

import { apiPost } from "@/lib/api/fetch-json";
import type { AiAgentTaskInjectionExecutedResponse } from "@/lib/ai/agent/intake/task-injection-service";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaSummary,
} from "@/lib/ai/admin/control-plane-contract";
import { AiAgentLabSurface } from "./AiAgentLabSurface";
import {
  buildCandidateStage,
  buildInitialModes,
  buildSelectorStage,
  filterLabModels,
} from "./lab-data";

type Props = {
  runtimePreviews: {
    notification: AiAgentRuntimeSourceSnapshot | null;
    public: AiAgentRuntimeSourceSnapshot | null;
  };
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  personas: PersonaSummary[];
};

export function AdminAiAgentLabClient({ runtimePreviews, models, providers, personas }: Props) {
  const labModels = filterLabModels(models);

  return (
    <AiAgentLabSurface
      dataSource="runtime"
      titleEyebrow="Admin"
      title="AI Agent Lab"
      description="Live runtime inspection and manual task insertion surface for public and notification intake."
      sourceModeOptions={[
        { value: "public", label: "Public Runtime" },
        { value: "notification", label: "Notification Runtime" },
      ]}
      initialSourceMode="public"
      models={labModels}
      providers={providers}
      initialModelId={labModels[0]?.id ?? ""}
      initialModes={buildInitialModes({
        ...runtimePreviews,
        personaSummaries: personas,
      })}
      onRunSelector={async ({ sourceMode, personaGroup }) =>
        buildSelectorStage({
          snapshot: sourceMode === "public" ? runtimePreviews.public : runtimePreviews.notification,
          personaGroup,
        })
      }
      onRunCandidate={async ({ sourceMode, personaGroup }) =>
        buildCandidateStage({
          kind: sourceMode,
          snapshot: sourceMode === "public" ? runtimePreviews.public : runtimePreviews.notification,
          personaGroup,
          personaSummaries: personas,
        })
      }
      onSaveTask={async ({ row }) => {
        if (!row.candidate) {
          throw new Error("Task row is missing candidate payload.");
        }

        const response = await apiPost<AiAgentTaskInjectionExecutedResponse>(
          "/api/admin/ai/agent/lab/save-task",
          {
            candidate: row.candidate,
          },
        );
        const result = response.injectionPreview.results[0] ?? null;
        const insertedTask = response.insertedTasks[0] ?? null;

        return {
          inserted: result?.inserted ?? false,
          skipReason: result?.skipReason ?? null,
          taskId: result?.taskId ?? null,
          errorMessage: result?.skipReason ?? insertedTask?.errorMessage ?? null,
          status: insertedTask?.status ?? (result?.inserted ? "PENDING" : "FAILED"),
        };
      }}
    />
  );
}
