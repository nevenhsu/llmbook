import { describe, it, expect, vi } from "vitest";
import { generateTaskIntents } from "@/agents/heartbeat-observer/orchestrator/generate-task-intents";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import { createReplyDispatchPrecheck } from "@/agents/task-dispatcher/precheck/reply-dispatch-precheck";
import { InMemoryTaskQueueStore, TaskQueue } from "@/lib/ai/task-queue/task-queue";
import { InMemoryTaskEventSink } from "@/lib/ai/observability/task-events";
import {
  InMemoryIdempotencyStore,
  ReplyExecutionAgent,
} from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import { SafetyReasonCode } from "@/lib/ai/reason-codes";
import { composeSoulDrivenReply } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import { CachedRuntimeSoulProvider } from "@/lib/ai/soul/runtime-soul-profile";
import { generateReplyTextWithPromptRuntime } from "@/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime";
import { MockModelAdapter, VercelAiCoreAdapter } from "@/lib/ai/prompt-runtime/model-adapter";

describe("Phase1 reply-only flow", () => {
  it("runs intent -> dispatch -> run -> safety -> write -> done", async () => {
    const now = new Date("2026-02-23T00:00:00.000Z");

    const heartbeat = generateTaskIntents({
      signals: [
        {
          kind: "unanswered_comment",
          sourceId: "comment-1",
          createdAt: now.toISOString(),
          threadId: "thread-1",
          boardId: "board-1",
        },
      ],
      now,
      makeIntentId: () => "intent-1",
    });

    expect(heartbeat.status).toBe("TASK_INTENTS");

    const store = new InMemoryTaskQueueStore();
    const sink = new InMemoryTaskEventSink();
    const queue = new TaskQueue({ store, eventSink: sink, leaseMs: 30_000 });

    const dispatch = await dispatchIntents({
      intents: heartbeat.intents,
      personas: [{ id: "persona-1", status: "active" }],
      policy: { ...loadDispatcherPolicy(), precheckEnabled: false, replyEnabled: true },
      now,
      makeTaskId: () => "task-1",
      createTask: async (task) => {
        store.upsert(task);
      },
    });

    expect(dispatch[0]?.dispatched).toBe(true);
    expect(store.snapshot()).toHaveLength(1);

    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-created-1" }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "thanks for sharing" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
    });

    const run = await agent.runOnce({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });

    expect(run).toBe("DONE");
    expect(writer.write).toHaveBeenCalledTimes(1);

    const task = store.snapshot()[0];
    expect(task?.status).toBe("DONE");
    expect(task?.resultId).toBe("comment-created-1");

    expect(
      sink.events.some((event) => event.fromStatus === "PENDING" && event.toStatus === "RUNNING"),
    ).toBe(true);
    expect(
      sink.events.some((event) => event.fromStatus === "RUNNING" && event.toStatus === "DONE"),
    ).toBe(true);
  });

  it("uses thread memory context in precheck and blocks similar draft", async () => {
    const now = new Date("2026-02-23T00:00:00.000Z");
    const intents = [
      {
        id: "intent-2",
        type: "reply" as const,
        sourceTable: "comments" as const,
        sourceId: "comment-2",
        createdAt: now.toISOString(),
        payload: {
          postId: "post-2",
          threadId: "thread-2",
          boardId: "board-1",
        },
      },
    ];

    const store = new InMemoryTaskQueueStore();

    const precheck = createReplyDispatchPrecheck({
      policy: {
        ...loadDispatcherPolicy(),
        precheckEnabled: true,
        precheckSimilarityThreshold: 0.9,
      },
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          policyRefs: {
            policyVersion: 1,
          },
          memoryRefs: {
            communityMemoryVersion: "c1",
            safetyMemoryVersion: "s1",
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: "thread-2",
            boardId: "board-1",
            taskType: "reply",
            ttlSeconds: 3600,
            maxItems: 10,
            entries: [
              {
                id: "m-1",
                key: "recent",
                value: "same text",
                metadata: {},
                ttlSeconds: 3600,
                maxItems: 10,
                expiresAt: "2026-02-23T01:00:00.000Z",
                updatedAt: "2026-02-23T00:10:00.000Z",
              },
            ],
          },
        }),
        generateDraft: async () => ({
          text: "same text",
          safetyContext: { recentPersonaReplies: [] },
        }),
        runSafetyCheck: async ({ text, context }) => {
          if (context?.recentPersonaReplies.includes(text)) {
            return {
              allowed: false,
              reasonCode: SafetyReasonCode.similarToRecentReply,
              reason: "blocked by thread memory",
            };
          }
          return { allowed: true };
        },
        recordSafetyEvent: async () => {},
      },
    });

    const dispatch = await dispatchIntents({
      intents,
      personas: [{ id: "persona-1", status: "active" }],
      policy: { ...loadDispatcherPolicy(), precheckEnabled: true, replyEnabled: true },
      now,
      precheck,
      makeTaskId: () => "task-2",
      createTask: async (task) => {
        store.upsert(task);
      },
    });

    expect(dispatch[0]?.dispatched).toBe(false);
    expect(dispatch[0]?.reasons).toContain("PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY");
    expect(store.snapshot()).toHaveLength(0);
  });

  it("runs phase1 execution with and without soul and produces observable tone difference", async () => {
    const store = new InMemoryTaskQueueStore([
      {
        id: "task-soul",
        personaId: "persona-soul",
        taskType: "reply",
        payload: { postId: "post-1", idempotencyKey: "idem-soul" },
        status: "PENDING",
        scheduledAt: new Date("2026-02-26T00:00:00.000Z"),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date("2026-02-26T00:00:00.000Z"),
      },
      {
        id: "task-fallback",
        personaId: "persona-fallback",
        taskType: "reply",
        payload: { postId: "post-1", idempotencyKey: "idem-fallback" },
        status: "PENDING",
        scheduledAt: new Date("2026-02-26T00:00:01.000Z"),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date("2026-02-26T00:00:01.000Z"),
      },
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const writtenTexts: string[] = [];

    const soulProvider = new CachedRuntimeSoulProvider({
      deps: {
        getSoulProfile: async ({ personaId }) =>
          personaId === "persona-soul"
            ? {
                identityCore: "An assertive analyst",
                valueHierarchy: [{ value: "decisiveness", priority: 1 }],
                decisionPolicy: {
                  tradeoffStyle: "progressive",
                  uncertaintyHandling: "test quickly and adapt",
                },
                interactionDoctrine: {
                  askVsTellRatio: "tell-first",
                  collaborationStance: "support",
                },
                languageSignature: {
                  rhythm: "direct",
                },
                guardrails: {
                  hardNo: ["unsafe actions"],
                  deescalationRules: ["de-risk before scaling"],
                },
              }
            : null,
      },
    });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: {
        generate: async (task) => {
          const soul = await soulProvider.getRuntimeSoul({ personaId: task.personaId });
          return {
            text: composeSoulDrivenReply({
              title: "Execution Test",
              postBodySnippet: "Need a next step",
              focusActor: "user:test",
              focusSnippet: "what should we do next?",
              participantCount: 2,
              soul,
            }),
          };
        },
      },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer: {
        write: async ({ text }) => {
          writtenTexts.push(text);
          return { resultId: `comment-${writtenTexts.length}` };
        },
      },
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-26T00:00:10.000Z") });
    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-26T00:00:11.000Z") });

    expect(writtenTexts).toHaveLength(2);
    expect(writtenTexts[0]).not.toBe(writtenTexts[1]);
    expect(writtenTexts.some((text) => text.includes("Directly speaking"))).toBe(true);
    expect(writtenTexts.some((text) => text.includes("Concisely"))).toBe(true);
    expect(store.snapshot().every((task) => task.status === "DONE")).toBe(true);
  });

  it("runs phase1 execution with model on/off and keeps flow pass-through", async () => {
    const store = new InMemoryTaskQueueStore([
      {
        id: "task-model-on",
        personaId: "persona-1",
        taskType: "reply",
        payload: { postId: "post-1", idempotencyKey: "idem-on" },
        status: "PENDING",
        scheduledAt: new Date("2026-02-26T00:00:00.000Z"),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date("2026-02-26T00:00:00.000Z"),
      },
      {
        id: "task-model-off",
        personaId: "persona-2",
        taskType: "reply",
        payload: { postId: "post-1", idempotencyKey: "idem-off" },
        status: "PENDING",
        scheduledAt: new Date("2026-02-26T00:00:01.000Z"),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date("2026-02-26T00:00:01.000Z"),
      },
    ]);

    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const outputs: string[] = [];

    const modelOn = new MockModelAdapter({ mode: "success", fixedText: "model-on text" });
    const modelOff = new VercelAiCoreAdapter({ enabled: false });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: {
        generate: async (task) => {
          const runtime = await generateReplyTextWithPromptRuntime({
            entityId: task.id,
            personaId: task.personaId,
            postId: String(task.payload.postId ?? "post-1"),
            title: "Prompt Runtime Test",
            postBodySnippet: "Need next action",
            focusActor: "user:test",
            focusSnippet: "what should we do",
            participantCount: 2,
            soul: {
              profile: {
                identityCore: "A practical teammate",
                valueHierarchy: [{ value: "clarity", priority: 1 }],
                decisionPolicy: {
                  evidenceStandard: "medium",
                  tradeoffStyle: "balanced",
                  uncertaintyHandling: "state assumptions",
                  antiPatterns: ["overclaim"],
                  riskPreference: "balanced",
                },
                interactionDoctrine: {
                  askVsTellRatio: "balanced",
                  feedbackPrinciples: ["tradeoff"],
                  collaborationStance: "support",
                },
                languageSignature: {
                  rhythm: "concise",
                  preferredStructures: ["context"],
                  lexicalTaboos: [],
                },
                guardrails: {
                  hardNo: ["unsafe"],
                  deescalationRules: ["de-risk"],
                },
              },
              summary: {
                identity: "A practical teammate",
                topValues: ["clarity"],
                tradeoffStyle: "balanced",
                riskPreference: "balanced",
                collaborationStance: "support",
                rhythm: "concise",
                guardrailCount: 2,
              },
              normalized: false,
              source: "db",
            },
            memoryContext: null,
            deterministicFallbackText: "deterministic text",
            modelAdapter: task.id === "task-model-on" ? modelOn : modelOff,
          });

          return { text: runtime.text };
        },
      },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer: {
        write: async ({ text }) => {
          outputs.push(text);
          return { resultId: `result-${outputs.length}` };
        },
      },
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-26T00:00:10.000Z") });
    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-26T00:00:11.000Z") });

    expect(outputs).toHaveLength(2);
    expect(outputs).toContain("model-on text");
    expect(outputs).toContain("deterministic text");
    expect(store.snapshot().every((task) => task.status === "DONE")).toBe(true);
  });
});
