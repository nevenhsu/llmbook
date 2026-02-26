import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { ToolRegistry, type ToolDefinition } from "@/lib/ai/prompt-runtime/tool-registry";

export type ReplyPhase1ToolContext = {
  postId: string;
  personaId: string;
  title: string;
  postBodySnippet: string;
  focusActor: string;
  focusSnippet: string | null;
  participantCount: number;
  memoryContext: RuntimeMemoryContext | null;
};

type ReplyDraftInput = {
  postId: string;
  parent_comment_id?: string;
  markdown_content: string;
  idempotency_key: string;
};

export type ReplyPhase1ToolDeps = {
  getThreadContext?: (input: {
    postId: string;
    limit?: number;
  }) => Promise<Record<string, unknown>>;
  getPersonaMemory?: (input: {
    personaId: string;
    postId: string;
  }) => Promise<Record<string, unknown>>;
  getGlobalPolicy?: () => Promise<Record<string, unknown>>;
  createReply?: (input: ReplyDraftInput) => Promise<Record<string, unknown>>;
};

function buildDefaultGetThreadContext(context: ReplyPhase1ToolContext) {
  return async ({
    limit,
  }: {
    postId: string;
    limit?: number;
  }): Promise<Record<string, unknown>> => ({
    postId: context.postId,
    title: context.title,
    postBodySnippet: context.postBodySnippet,
    focusActor: context.focusActor,
    focusSnippet: context.focusSnippet,
    participantCount: context.participantCount,
    limit: typeof limit === "number" ? limit : 8,
  });
}

function buildDefaultGetPersonaMemory(context: ReplyPhase1ToolContext) {
  return async (): Promise<Record<string, unknown>> => ({
    personaId: context.personaId,
    postId: context.postId,
    policyRefs: context.memoryContext?.policyRefs ?? null,
    memoryRefs: context.memoryContext?.memoryRefs ?? null,
    longMemory: context.memoryContext?.personaLongMemory?.content ?? null,
    threadMemory: (context.memoryContext?.threadShortMemory.entries ?? []).map((entry) => ({
      key: entry.key,
      value: entry.value,
      updatedAt: entry.updatedAt,
    })),
  });
}

function buildDefaultGetGlobalPolicy() {
  return async (): Promise<Record<string, unknown>> => {
    const policy = loadDispatcherPolicy();
    return {
      replyEnabled: policy.replyEnabled,
      precheckEnabled: policy.precheckEnabled,
      perPersonaHourlyReplyLimit: policy.perPersonaHourlyReplyLimit,
      perPostCooldownSeconds: policy.perPostCooldownSeconds,
      precheckSimilarityThreshold: policy.precheckSimilarityThreshold,
    };
  };
}

function buildDefaultCreateReply() {
  return async (input: ReplyDraftInput): Promise<Record<string, unknown>> => ({
    mode: "mock",
    accepted: true,
    postId: input.postId,
    parentCommentId: input.parent_comment_id ?? null,
    idempotencyKey: input.idempotency_key,
    markdownLength: input.markdown_content.length,
  });
}

export function createReplyPhase1ToolRegistry(input: {
  context: ReplyPhase1ToolContext;
  deps?: ReplyPhase1ToolDeps;
  allowlist?: string[];
}): ToolRegistry {
  const registry = new ToolRegistry({
    allowlist: input.allowlist ?? [
      "get_thread_context",
      "get_persona_memory",
      "get_global_policy",
      "create_reply",
    ],
  });

  const getThreadContext =
    input.deps?.getThreadContext ?? buildDefaultGetThreadContext(input.context);
  const getPersonaMemory =
    input.deps?.getPersonaMemory ?? buildDefaultGetPersonaMemory(input.context);
  const getGlobalPolicy = input.deps?.getGlobalPolicy ?? buildDefaultGetGlobalPolicy();
  const createReply = input.deps?.createReply ?? buildDefaultCreateReply();

  const tools: ToolDefinition[] = [
    {
      name: "get_thread_context",
      description: "Get compact thread context for reply drafting.",
      schema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "Target post id" },
          limit: { type: "number", description: "Max items to summarize" },
        },
        required: ["post_id"],
        additionalProperties: false,
      },
      handler: async (args) =>
        getThreadContext({
          postId: String(args.post_id),
          limit: typeof args.limit === "number" ? args.limit : undefined,
        }),
    },
    {
      name: "get_persona_memory",
      description: "Read persona runtime memory and recent thread memory.",
      schema: {
        type: "object",
        properties: {
          persona_id: { type: "string", description: "Persona id" },
          post_id: { type: "string", description: "Thread/post id" },
        },
        required: ["persona_id", "post_id"],
        additionalProperties: false,
      },
      handler: async (args) =>
        getPersonaMemory({
          personaId: String(args.persona_id),
          postId: String(args.post_id),
        }),
    },
    {
      name: "get_global_policy",
      description: "Read active reply policy and guardrails.",
      schema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      handler: async () => getGlobalPolicy(),
    },
    {
      name: "create_reply",
      description: "Create a draft reply artifact (mock in phase1 runtime).",
      schema: {
        type: "object",
        properties: {
          post_id: { type: "string", description: "Target post id" },
          parent_comment_id: { type: "string", description: "Target parent comment id" },
          markdown_content: { type: "string", description: "Markdown reply body" },
          idempotency_key: { type: "string", description: "Idempotency key" },
        },
        required: ["post_id", "markdown_content", "idempotency_key"],
        additionalProperties: false,
      },
      handler: async (args) =>
        createReply({
          postId: String(args.post_id),
          parent_comment_id:
            typeof args.parent_comment_id === "string" ? String(args.parent_comment_id) : undefined,
          markdown_content: String(args.markdown_content),
          idempotency_key: String(args.idempotency_key),
        }),
    },
  ];

  for (const tool of tools) {
    registry.register(tool);
  }

  return registry;
}
