import type { AiAgentRuntimeIntakeKind } from "@/lib/ai/agent/intake/intake-read-model";

export type IntakeProgressEvent =
  | {
      type: "snapshot_loaded";
      kind: AiAgentRuntimeIntakeKind;
      sourceNames: string[];
      itemCount: number;
      statusLabel: string;
    }
  | {
      type: "opportunity_ingest_completed";
      kind: AiAgentRuntimeIntakeKind;
      snapshotItemCount: number;
      ingestedCount: number;
    }
  | {
      type: "opportunity_scoring_scope_loaded";
      kind: AiAgentRuntimeIntakeKind;
      cycleCount: number;
      unscoredCount: number;
    }
  | {
      type: "opportunity_scoring_batch_started";
      kind: AiAgentRuntimeIntakeKind;
      batchIndex: number;
      batchCount: number;
      rowCount: number;
    }
  | {
      type: "opportunity_scoring_batch_completed";
      kind: AiAgentRuntimeIntakeKind;
      batchIndex: number;
      batchCount: number;
      rowCount: number;
      updatedCount: number;
      selectedCount: number;
      rejectedCount: number;
    }
  | {
      type: "notification_selected_rows_loaded";
      kind: "notification";
      selectedCount: number;
      activeCount: number;
      inactiveCount: number;
    }
  | {
      type: "notification_task_candidates_built";
      kind: "notification";
      candidateCount: number;
    }
  | {
      type: "notification_injection_completed";
      kind: "notification";
      candidateCount: number;
      insertedCount: number;
      skippedCount: number;
      processedOpportunityCount: number;
    }
  | {
      type: "public_candidate_scope_loaded";
      kind: "public";
      candidateEpoch: number;
      requestedGroupIndex: number;
      effectiveGroupIndex: number;
      referenceCount: number;
      totalReferences: number;
      batchSize: number;
      eligibleCount: number;
    }
  | {
      type: "public_candidate_batch_started";
      kind: "public";
      batchIndex: number;
      batchCount: number;
      rowCount: number;
    }
  | {
      type: "public_candidate_batch_completed";
      kind: "public";
      batchIndex: number;
      batchCount: number;
      rowCount: number;
      candidateCount: number;
      insertedCount: number;
      skippedCount: number;
    };
