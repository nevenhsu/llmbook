import { loadAiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import { AiAgentIntakePreviewStore } from "@/lib/ai/agent/intake/intake-read-model";
import {
  AiAgentOpportunityPipelineService,
  type AiAgentOpportunityPipelineEvent,
} from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import {
  AiAgentOrchestratorPhaseService,
  type AiAgentOrchestratorPhaseExecutedResult,
} from "@/lib/ai/agent/orchestrator/orchestrator-phase-service";
import { SupabaseHeartbeatSource } from "@/lib/ai/data-sources/supabase-heartbeat-source";

type LocalPhaseAConfig = {
  orchestratorCooldownMinutes: number;
};

type LocalPhaseARunnerDeps = {
  loadConfig: () => Promise<LocalPhaseAConfig>;
  runPhase: () => Promise<AiAgentOrchestratorPhaseExecutedResult>;
  now: () => Date;
  writeLine: (line: string) => void;
};

export type AiAgentLocalPhaseARunResult = {
  orchestratorResult: AiAgentOrchestratorPhaseExecutedResult;
  wouldCooldownUntil: string;
  cooldownMinutes: number;
};

function formatPhaseAEvent(event: AiAgentOpportunityPipelineEvent): string {
  switch (event.type) {
    case "snapshot_loaded":
      return `[phase-a][${event.kind}] snapshot sources=${event.sourceNames.join(",")} items=${event.itemCount} status="${event.statusLabel}"`;
    case "opportunity_ingest_completed":
      return `[phase-a][${event.kind}] ingest snapshot_items=${event.snapshotItemCount} new_ai_opps=${event.ingestedCount}`;
    case "opportunity_scoring_scope_loaded":
      return `[phase-a][${event.kind}] opportunities cycle_rows=${event.cycleCount} unscored=${event.unscoredCount}`;
    case "opportunity_scoring_batch_started":
      return `[phase-a][${event.kind}] opportunities batch ${event.batchIndex}/${event.batchCount} start rows=${event.rowCount}`;
    case "opportunity_scoring_batch_completed":
      return `[phase-a][${event.kind}] opportunities batch ${event.batchIndex}/${event.batchCount} done updated=${event.updatedCount} selected=${event.selectedCount} rejected=${event.rejectedCount}`;
    case "notification_selected_rows_loaded":
      return `[phase-a][notification] selected_rows=${event.selectedCount} active=${event.activeCount} inactive=${event.inactiveCount}`;
    case "notification_task_candidates_built":
      return `[phase-a][notification] direct_task_candidates=${event.candidateCount}`;
    case "notification_injection_completed":
      return `[phase-a][notification] injection candidates=${event.candidateCount} inserted=${event.insertedCount} skipped=${event.skippedCount} processed_opps=${event.processedOpportunityCount}`;
    case "public_candidate_scope_loaded":
      return `[phase-a][public] candidate scope epoch=${event.candidateEpoch} requested_group=${event.requestedGroupIndex} effective_group=${event.effectiveGroupIndex} refs=${event.referenceCount}/${event.totalReferences} eligible=${event.eligibleCount} batch_size=${event.batchSize}`;
    case "public_candidate_batch_started":
      return `[phase-a][public] candidates batch ${event.batchIndex}/${event.batchCount} start opps=${event.rowCount}`;
    case "public_candidate_batch_completed":
      return `[phase-a][public] candidates batch ${event.batchIndex}/${event.batchCount} done candidates=${event.candidateCount} inserted=${event.insertedCount} skipped=${event.skippedCount}`;
  }
}

export class AiAgentLocalPhaseARunnerService {
  private readonly deps: LocalPhaseARunnerDeps;

  public constructor(options?: { deps?: Partial<LocalPhaseARunnerDeps> }) {
    const writeLine =
      options?.deps?.writeLine ?? ((line: string) => process.stdout.write(`${line}\n`));
    const heartbeatSource = new SupabaseHeartbeatSource();
    const previewStore = new AiAgentIntakePreviewStore({
      deps: {
        fetchRecentEvents: (sourceName) =>
          heartbeatSource.fetchRecentEvents(sourceName, {
            createCheckpointIfMissing: false,
          }),
      },
    });
    const pipelineService = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: () => previewStore.getRuntimePreviewSet(),
      },
      onEvent: (event) => {
        writeLine(formatPhaseAEvent(event));
      },
    });
    const phaseService = new AiAgentOrchestratorPhaseService({
      deps: {
        executeOpportunityPipeline: (kind) => pipelineService.executeFlow({ kind }),
      },
    });

    this.deps = {
      loadConfig:
        options?.deps?.loadConfig ??
        (async () => {
          const values = (await loadAiAgentConfig()).values;
          return {
            orchestratorCooldownMinutes: values.orchestratorCooldownMinutes,
          };
        }),
      runPhase: options?.deps?.runPhase ?? (() => phaseService.runPhase()),
      now: options?.deps?.now ?? (() => new Date()),
      writeLine,
    };
  }

  public async runOnce(): Promise<AiAgentLocalPhaseARunResult> {
    const startedAt = this.deps.now();
    const config = await this.deps.loadConfig();
    this.deps.writeLine(
      `[phase-a] Local Phase A run started at ${startedAt.toISOString()} cooldown_minutes=${config.orchestratorCooldownMinutes}`,
    );

    const orchestratorResult = await this.deps.runPhase();
    const finishedAt = this.deps.now();
    const wouldCooldownUntil = new Date(
      finishedAt.getTime() + config.orchestratorCooldownMinutes * 60_000,
    ).toISOString();

    this.deps.writeLine(
      `[phase-a] summary public_tasks=${orchestratorResult.injectedPublicTasks} notification_tasks=${orchestratorResult.injectedNotificationTasks}`,
    );
    this.deps.writeLine(
      `[phase-a] Would set cooldown_until=${wouldCooldownUntil} (${config.orchestratorCooldownMinutes} min) for runtime orchestration, not persisted in local run.`,
    );

    return {
      orchestratorResult,
      wouldCooldownUntil,
      cooldownMinutes: config.orchestratorCooldownMinutes,
    };
  }
}
