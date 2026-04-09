import { AdminAiControlPlaneStore, type PreviewResult } from "@/lib/ai/admin/control-plane-store";
import { getActiveOrderedModels } from "@/lib/ai/admin/active-model-order";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import {
  AiAgentPersonaTaskContextBuilder,
  type AiAgentPersonaTaskPromptContext,
} from "@/lib/ai/agent/execution/persona-task-context-builder";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import { createAdminClient } from "@/lib/supabase/admin";

type PersonaIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type TaskRow = {
  id: string;
  persona_id: string;
  task_type: string;
  dispatch_kind: string;
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string | null;
  cooldown_until: string | null;
  payload: Record<string, unknown> | null;
  status: AiAgentRecentTaskSnapshot["status"];
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  lease_owner: string | null;
  lease_until: string | null;
  result_id: string | null;
  result_type: string | null;
  error_message: string | null;
  created_at: string;
};

type PreferredTextModel = {
  modelId: string;
  providerKey: string;
  modelKey: string;
};

type PersonaTaskServiceDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  buildPromptContext: (input: {
    task: AiAgentRecentTaskSnapshot;
  }) => Promise<AiAgentPersonaTaskPromptContext>;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteraction: (input: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment";
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }) => Promise<PreviewResult>;
};

export class AiAgentJobPermanentSkipError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AiAgentJobPermanentSkipError";
  }
}

export type AiAgentPersonaTaskExecutionMode = "runtime" | "preview";

export type AiAgentPersonaTaskGeneratedOutput =
  | {
      kind: "post";
      title: string;
      body: string;
      tags: string[];
    }
  | {
      kind: "comment";
      body: string;
    };

export type AiAgentPersonaTaskGenerationResult = {
  task: AiAgentRecentTaskSnapshot;
  mode: AiAgentPersonaTaskExecutionMode;
  promptContext: AiAgentPersonaTaskPromptContext;
  preview: PreviewResult;
  parsedOutput: AiAgentPersonaTaskGeneratedOutput;
  modelMetadata: Record<string, unknown>;
  modelSelection: PreferredTextModel;
};

function normalizeTaskType(taskType: string): "post" | "comment" {
  return taskType === "post" ? "post" : "comment";
}

export class AiAgentPersonaTaskService {
  private readonly deps: PersonaTaskServiceDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskServiceDeps> }) {
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => this.readTaskById(taskId)),
      buildPromptContext:
        options?.deps?.buildPromptContext ??
        (async (input) => {
          const contextBuilder = new AiAgentPersonaTaskContextBuilder();
          return contextBuilder.build(input);
        }),
      loadPreferredTextModel:
        options?.deps?.loadPreferredTextModel ??
        (async () => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          const { providers, models } = await controlPlaneStore.getActiveControlPlane();
          const preferredModel = getActiveOrderedModels({
            providers,
            models,
            capability: "text_generation",
            promptModality: "text_only",
          })[0];

          if (!preferredModel) {
            throw new Error("no active text_generation model is available for rewrite execution");
          }

          const provider = providers.find((item) => item.id === preferredModel.providerId);
          if (!provider) {
            throw new Error("provider not found for rewrite model");
          }

          return {
            modelId: preferredModel.id,
            providerKey: provider.providerKey,
            modelKey: preferredModel.modelKey,
          };
        }),
      runPersonaInteraction:
        options?.deps?.runPersonaInteraction ??
        (async (input) => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          return controlPlaneStore.runPersonaInteraction(input);
        }),
    };
  }

  public async generateFromTask(input: {
    personaTaskId: string;
    mode?: AiAgentPersonaTaskExecutionMode;
    extraInstructions?: string | null;
  }): Promise<AiAgentPersonaTaskGenerationResult> {
    const task = await this.deps.loadTaskById(input.personaTaskId);
    if (!task) {
      throw new AiAgentJobPermanentSkipError("persona_task not found");
    }

    const mode = input.mode ?? "preview";
    const promptContext = await this.deps.buildPromptContext({ task });
    const preferredModel = await this.deps.loadPreferredTextModel();
    const taskContext =
      input.extraInstructions && input.extraInstructions.trim().length > 0
        ? [promptContext.taskContext, input.extraInstructions.trim()].join("\n\n")
        : promptContext.taskContext;
    const preview = await this.deps.runPersonaInteraction({
      personaId: task.personaId,
      modelId: preferredModel.modelId,
      taskType: promptContext.taskType,
      taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: promptContext.targetContextText,
    });

    const rawOutput = preview.rawResponse ?? preview.markdown;
    const modelMetadata = {
      schema_version: 1,
      model_id: preferredModel.modelId,
      provider_key: preferredModel.providerKey,
      model_key: preferredModel.modelKey,
      audit_status: preview.auditDiagnostics?.status ?? null,
      repair_applied: preview.auditDiagnostics?.repairApplied ?? false,
      task_type: task.taskType,
      dispatch_kind: task.dispatchKind,
    } satisfies Record<string, unknown>;

    if (normalizeTaskType(task.taskType) === "post") {
      const parsed = parsePostActionOutput(rawOutput);
      if (parsed.error || !parsed.title) {
        throw new Error(
          parsed.error ?? "persona_task generation did not produce a valid post payload",
        );
      }

      return {
        task,
        mode,
        promptContext: {
          ...promptContext,
          taskContext,
        },
        preview,
        parsedOutput: {
          kind: "post",
          title: parsed.title,
          body: parsed.body,
          tags: parsed.normalizedTags,
        },
        modelMetadata,
        modelSelection: preferredModel,
      };
    }

    const parsed = parseMarkdownActionOutput(rawOutput);
    if (!parsed.markdown.trim()) {
      throw new Error("persona_task generation did not produce a valid comment markdown body");
    }

    return {
      task,
      mode,
      promptContext: {
        ...promptContext,
        taskContext,
      },
      preview,
      parsedOutput: {
        kind: "comment",
        body: parsed.markdown,
      },
      modelMetadata,
      modelSelection: preferredModel,
    };
  }
  private async readTaskById(taskId: string): Promise<AiAgentRecentTaskSnapshot | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
      )
      .eq("id", taskId)
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`load persona_task for rewrite failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("id, username, display_name")
      .eq("id", data.persona_id)
      .maybeSingle<PersonaIdentityRow>();

    if (personaError) {
      throw new Error(`load rewrite persona identity failed: ${personaError.message}`);
    }

    return {
      id: data.id,
      personaId: data.persona_id,
      personaUsername: persona?.username ?? null,
      personaDisplayName: persona?.display_name ?? null,
      taskType: data.task_type,
      dispatchKind: data.dispatch_kind,
      sourceTable: data.source_table,
      sourceId: data.source_id,
      dedupeKey: data.dedupe_key,
      cooldownUntil: data.cooldown_until,
      payload: data.payload ?? {},
      status: data.status,
      scheduledAt: data.scheduled_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      retryCount: data.retry_count,
      maxRetries: data.max_retries,
      leaseOwner: data.lease_owner,
      leaseUntil: data.lease_until,
      resultId: data.result_id,
      resultType: data.result_type,
      errorMessage: data.error_message,
      createdAt: data.created_at,
    };
  }
}
