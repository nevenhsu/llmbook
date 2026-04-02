import { loadAiAgentConfig, type AiAgentConfigSnapshot } from "@/lib/ai/agent/config/agent-config";
import {
  buildSelectorInputPreview,
  type IntakeOpportunityFixture,
  type SelectorInputPreview,
} from "@/lib/ai/agent/intake/intake-preview";
import {
  SupabaseHeartbeatSource,
  type HeartbeatEvent,
  type HeartbeatEventSourceName,
} from "@/lib/ai/data-sources/supabase-heartbeat-source";

export type AiAgentRuntimeIntakeKind = "notification" | "public";

export type AiAgentRuntimeSourceSnapshot = {
  kind: AiAgentRuntimeIntakeKind;
  statusLabel: "ready" | "empty";
  sourceNames: HeartbeatEventSourceName[];
  items: Array<
    IntakeOpportunityFixture & {
      sourceId: string;
      createdAt: string;
    }
  >;
  selectorInput: SelectorInputPreview | null;
};

type IntakeDeps = {
  loadConfig: () => Promise<AiAgentConfigSnapshot>;
  fetchRecentEvents: (sourceName: HeartbeatEventSourceName) => Promise<HeartbeatEvent[]>;
};

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function mapNotificationEvents(
  events: HeartbeatEvent[],
  selectorReferenceBatchSize: number,
): AiAgentRuntimeSourceSnapshot {
  const items = events.slice(0, selectorReferenceBatchSize).map((event) => ({
    source: "notification",
    contentType: typeof event.payload.type === "string" ? event.payload.type : "notification",
    summary: truncate(
      String(
        event.payload.body ?? event.payload.title ?? event.payload.type ?? "Notification event",
      ),
      140,
    ),
    sourceId: event.sourceId,
    createdAt: event.createdAt,
    metadata: {
      postId: typeof event.payload.postId === "string" ? event.payload.postId : null,
      commentId: typeof event.payload.commentId === "string" ? event.payload.commentId : null,
      parentCommentId:
        typeof event.payload.parentCommentId === "string" ? event.payload.parentCommentId : null,
      context: typeof event.payload.context === "string" ? event.payload.context : null,
      notificationType: typeof event.payload.type === "string" ? event.payload.type : null,
      boardSlug: typeof event.payload.boardSlug === "string" ? event.payload.boardSlug : null,
      recipientPersonaId:
        typeof event.payload.recipientPersonaId === "string"
          ? event.payload.recipientPersonaId
          : null,
    },
  }));

  return {
    kind: "notification",
    statusLabel: items.length > 0 ? "ready" : "empty",
    sourceNames: ["notifications"],
    items,
    selectorInput:
      items.length > 0
        ? buildSelectorInputPreview({
            fixtureMode: "notification-intake",
            groupIndexOverride: 0,
            selectorReferenceBatchSize,
            items,
          })
        : null,
  };
}

function mapPublicEvents(input: {
  posts: HeartbeatEvent[];
  comments: HeartbeatEvent[];
  config: AiAgentConfigSnapshot["values"];
}): AiAgentRuntimeSourceSnapshot {
  const postItems = input.posts.slice(0, input.config.maxPostsPerCycle).map((event) => ({
    source: "public-post",
    contentType: "post",
    summary: truncate(String(event.payload.title ?? "Recent public post"), 140),
    sourceId: event.sourceId,
    createdAt: event.createdAt,
    metadata: {
      boardId: typeof event.payload.boardId === "string" ? event.payload.boardId : null,
      boardSlug: typeof event.payload.boardSlug === "string" ? event.payload.boardSlug : null,
      postId: event.sourceId,
    },
  }));

  const commentItems = input.comments.slice(0, input.config.maxCommentsPerCycle).map((event) => ({
    source: "public-comment",
    contentType: "comment",
    summary: truncate(String(event.payload.body ?? "Recent public comment"), 140),
    sourceId: event.sourceId,
    createdAt: event.createdAt,
    metadata: {
      postId: typeof event.payload.postId === "string" ? event.payload.postId : null,
      commentId: event.sourceId,
      parentCommentId: typeof event.payload.parentId === "string" ? event.payload.parentId : null,
      boardId: typeof event.payload.boardId === "string" ? event.payload.boardId : null,
      boardSlug: typeof event.payload.boardSlug === "string" ? event.payload.boardSlug : null,
    },
  }));

  const items = [...postItems, ...commentItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    kind: "public",
    statusLabel: items.length > 0 ? "ready" : "empty",
    sourceNames: ["posts", "comments"],
    items,
    selectorInput:
      items.length > 0
        ? buildSelectorInputPreview({
            fixtureMode: "mixed-public-opportunity",
            groupIndexOverride: 0,
            selectorReferenceBatchSize: input.config.selectorReferenceBatchSize,
            items,
          })
        : null,
  };
}

export class AiAgentIntakePreviewStore {
  private readonly deps: IntakeDeps;

  public constructor(options?: { deps?: Partial<IntakeDeps> }) {
    const heartbeatSource = new SupabaseHeartbeatSource();
    this.deps = {
      loadConfig: options?.deps?.loadConfig ?? (() => loadAiAgentConfig()),
      fetchRecentEvents:
        options?.deps?.fetchRecentEvents ??
        ((sourceName) => heartbeatSource.fetchRecentEvents(sourceName)),
    };
  }

  public async getRuntimePreviewSet(): Promise<{
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  }> {
    const config = await this.deps.loadConfig();
    const [notifications, posts, comments] = await Promise.all([
      this.deps.fetchRecentEvents("notifications"),
      this.deps.fetchRecentEvents("posts"),
      this.deps.fetchRecentEvents("comments"),
    ]);

    return {
      notification: mapNotificationEvents(notifications, config.values.selectorReferenceBatchSize),
      public: mapPublicEvents({
        posts,
        comments,
        config: config.values,
      }),
    };
  }
}
