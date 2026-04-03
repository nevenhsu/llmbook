import { loadAiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import {
  AiAgentIntakePreviewStore,
  type AiAgentRuntimeIntakeKind,
  type AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import { AiAgentOpportunityPipelineService } from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import { AiOpportunityStore, type AiOppRow } from "@/lib/ai/agent/intake/opportunity-store";
import { buildSelectorInputPreview } from "@/lib/ai/agent/intake/intake-preview";

type AdminLabSourceServiceDeps = {
  loadConfig: () => Promise<{ values: { selectorReferenceBatchSize: number } }>;
  loadRuntimePreviewSet: () => Promise<{
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  }>;
  syncOpportunitySnapshot: (kind: AiAgentRuntimeIntakeKind) => Promise<void>;
  ingestSnapshotOnly: (input: {
    kind: AiAgentRuntimeIntakeKind;
    snapshot: AiAgentRuntimeSourceSnapshot;
  }) => Promise<void>;
  listAdminLabOpportunities: (kind: AiAgentRuntimeIntakeKind) => Promise<AiOppRow[]>;
};

function mapOppRowsToSnapshot(input: {
  kind: AiAgentRuntimeIntakeKind;
  rows: AiOppRow[];
  batchSize: number;
  groupIndex: number;
}): AiAgentRuntimeSourceSnapshot | null {
  if (input.rows.length === 0) {
    return null;
  }

  const items = input.rows.map((row) => ({
    source:
      row.kind === "notification"
        ? ("notification" as const)
        : row.source_table === "posts"
          ? ("public-post" as const)
          : ("public-comment" as const),
    contentType:
      row.kind === "notification"
        ? row.content_type
        : row.source_table === "posts"
          ? "post"
          : row.content_type,
    summary: row.summary,
    sourceId: row.source_id,
    createdAt: row.source_created_at ?? row.created_at,
    metadata: {
      opportunityId: row.id,
      boardId: row.board_id,
      boardSlug: row.board_slug,
      postId: row.post_id,
      commentId: row.comment_id,
      parentCommentId: row.parent_comment_id,
      recipientPersonaId: row.recipient_persona_id,
      context: row.notification_context,
      notificationType: row.notification_type,
      probability: row.probability,
      selected: row.selected,
    },
  }));

  return {
    kind: input.kind,
    statusLabel: items.length > 0 ? "ready" : "empty",
    sourceNames: input.kind === "notification" ? ["notifications"] : ["posts", "comments"],
    items,
    selectorInput: buildSelectorInputPreview({
      fixtureMode:
        input.kind === "notification" ? "notification-intake" : "mixed-public-opportunity",
      groupIndexOverride: input.groupIndex,
      selectorReferenceBatchSize: input.batchSize,
      items,
    }),
  };
}

export class AiAgentAdminLabSourceService {
  private readonly deps: AdminLabSourceServiceDeps;

  public constructor(options?: { deps?: Partial<AdminLabSourceServiceDeps> }) {
    const previewStore = new AiAgentIntakePreviewStore();
    const opportunityStore = new AiOpportunityStore();
    const pipelineService = new AiAgentOpportunityPipelineService();

    this.deps = {
      loadConfig: options?.deps?.loadConfig ?? (() => loadAiAgentConfig()),
      loadRuntimePreviewSet:
        options?.deps?.loadRuntimePreviewSet ?? (() => previewStore.getRuntimePreviewSet()),
      syncOpportunitySnapshot:
        options?.deps?.syncOpportunitySnapshot ??
        (async (kind) => {
          await pipelineService.syncOpportunities({ kind });
        }),
      ingestSnapshotOnly:
        options?.deps?.ingestSnapshotOnly ?? ((input) => pipelineService.ingestSnapshotOnly(input)),
      listAdminLabOpportunities:
        options?.deps?.listAdminLabOpportunities ??
        ((kind) => opportunityStore.listAdminLabOpportunities(kind)),
    };
  }

  public async loadSnapshot(input: {
    kind: AiAgentRuntimeIntakeKind;
    batchSize?: number;
    groupIndex?: number;
    score?: boolean;
  }): Promise<AiAgentRuntimeSourceSnapshot | null> {
    const config = await this.deps.loadConfig();
    const batchSize = input.batchSize ?? config.values.selectorReferenceBatchSize;
    const groupIndex = input.kind === "notification" ? 0 : (input.groupIndex ?? 0);

    const runtimePreviews = await this.deps.loadRuntimePreviewSet();
    const preview = input.kind === "public" ? runtimePreviews.public : runtimePreviews.notification;

    if (input.score !== false) {
      await this.deps.syncOpportunitySnapshot(input.kind);
    } else {
      await this.deps.ingestSnapshotOnly({
        kind: input.kind,
        snapshot: preview,
      });
    }

    const rows = await this.deps.listAdminLabOpportunities(input.kind);
    return mapOppRowsToSnapshot({
      kind: input.kind,
      rows,
      batchSize,
      groupIndex,
    });
  }
}
