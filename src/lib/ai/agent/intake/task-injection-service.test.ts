import { describe, expect, it } from "vitest";
import { AiAgentTaskInjectionService } from "@/lib/ai/agent/intake/task-injection-service";

describe("AiAgentTaskInjectionService", () => {
  it("uses inject_persona_tasks RPC results as the source of truth for inserted rows", async () => {
    const rpcCandidates: Array<{ persona_id: string; task_type: string }> = [];

    const service = new AiAgentTaskInjectionService({
      deps: {
        injectCandidates: async (candidates) => {
          rpcCandidates.push(
            ...candidates.map((candidate) => ({
              persona_id: candidate.persona_id,
              task_type: candidate.task_type,
            })),
          );
          expect(candidates[0]?.payload).toMatchObject({
            postId: "post-1",
            commentId: null,
            notificationType: "mention",
          });
          return [
            {
              candidate_index: 0,
              inserted: true,
              skip_reason: null,
              task_id: "task-1",
            },
            {
              candidate_index: 1,
              inserted: true,
              skip_reason: null,
              task_id: "task-2",
            },
          ];
        },
        loadInsertedTaskRows: async () => [
          {
            id: "task-1",
            persona_id: "persona-orchid",
            task_type: "comment",
            dispatch_kind: "notification",
            source_table: "notifications",
            source_id: "notification-1",
            dedupe_key: "ai_orchid:notification-intake-1:mention",
            cooldown_until: "2026-03-29T06:00:00.000Z",
            payload: { contentType: "mention" },
            status: "PENDING",
            scheduled_at: "2026-03-30T00:00:00.000Z",
            started_at: null,
            completed_at: null,
            retry_count: 0,
            max_retries: 3,
            lease_owner: null,
            lease_until: null,
            result_id: null,
            result_type: null,
            error_message: null,
            created_at: "2026-03-30T00:00:00.000Z",
          },
          {
            id: "task-2",
            persona_id: "persona-vesper",
            task_type: "comment",
            dispatch_kind: "notification",
            source_table: "notifications",
            source_id: "notification-1",
            dedupe_key: "ai_vesper:notification-intake-1:mention",
            cooldown_until: "2026-03-29T06:00:00.000Z",
            payload: { contentType: "mention" },
            status: "PENDING",
            scheduled_at: "2026-03-30T00:00:00.000Z",
            started_at: null,
            completed_at: null,
            retry_count: 0,
            max_retries: 3,
            lease_owner: null,
            lease_until: null,
            result_id: null,
            result_type: null,
            error_message: null,
            created_at: "2026-03-30T00:00:00.000Z",
          },
        ],
        loadPersonaIdentity: async (personaId) => ({
          id: personaId,
          username: personaId === "persona-orchid" ? "ai_orchid" : "ai_vesper",
          display_name: personaId === "persona-orchid" ? "Orchid" : "Vesper",
        }),
      },
    });

    const result = await service.executeCandidates({
      kind: "notification",
      candidates: [
        {
          candidateIndex: 0,
          opportunityKey: "opp-1",
          personaId: "persona-orchid",
          username: "ai_orchid",
          dispatchKind: "notification",
          sourceTable: "notifications",
          sourceId: "notification-1",
          dedupeKey: "ai_orchid:notification-intake-1:mention",
          cooldownUntil: "2026-03-29T06:00:00.000Z",
          payload: {
            contentType: "mention",
            source: "notification",
            summary: "Unread mention",
            fixtureMode: "notification-intake",
            boardId: "board-1",
            postId: "post-1",
            commentId: null,
            parentCommentId: null,
            context: "post",
            notificationType: "mention",
          },
        },
        {
          candidateIndex: 1,
          opportunityKey: "opp-2",
          personaId: "persona-vesper",
          username: "ai_vesper",
          dispatchKind: "notification",
          sourceTable: "notifications",
          sourceId: "notification-1",
          dedupeKey: "ai_vesper:notification-intake-1:mention",
          cooldownUntil: "2026-03-29T06:00:00.000Z",
          payload: {
            contentType: "mention",
            source: "notification",
            summary: "Unread mention",
            fixtureMode: "notification-intake",
            boardId: "board-1",
            postId: "post-1",
            commentId: null,
            parentCommentId: null,
            context: "post",
            notificationType: "mention",
          },
        },
      ],
    });

    expect(result.mode).toBe("executed");
    expect(result.kind).toBe("notification");
    expect(result.injectionPreview.summary.insertedCount).toBe(2);
    expect(result.injectionPreview.summary.skippedCount).toBe(0);
    expect(result.insertedTasks).toHaveLength(2);
    expect(rpcCandidates).toEqual([
      { persona_id: "persona-orchid", task_type: "comment" },
      { persona_id: "persona-vesper", task_type: "comment" },
    ]);
    expect(result.insertedTasks[0]?.personaUsername).toBe("ai_orchid");
  });
});
