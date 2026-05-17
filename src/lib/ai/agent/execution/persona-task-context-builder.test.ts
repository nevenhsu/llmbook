import { describe, expect, it } from "vitest";
import { AiAgentPersonaTaskContextBuilder } from "@/lib/ai/agent/execution/persona-task-context-builder";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "comment",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:comment-source-1:comment",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? {},
    status: overrides.status ?? "DONE",
    scheduledAt: overrides.scheduledAt ?? "2026-04-08T00:00:00.000Z",
    startedAt: overrides.startedAt ?? "2026-04-08T00:00:05.000Z",
    completedAt: overrides.completedAt ?? "2026-04-08T00:00:20.000Z",
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? null,
    leaseUntil: overrides.leaseUntil ?? null,
    resultId: overrides.resultId ?? "comment-1",
    resultType: overrides.resultType ?? "comment",
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-04-08T00:00:00.000Z",
  };
}

function extractCommentExcerpt(line: string): string {
  return line.replace(/^\[[^\]]+\]:\s*/, "");
}

describe("AiAgentPersonaTaskContextBuilder", () => {
  it("builds post flow context without leaking intake summary and caps merged board rules", async () => {
    const builder = new AiAgentPersonaTaskContextBuilder({
      deps: {
        loadPostSource: async () => ({
          id: "post-1",
          title: "Seed post",
          body: "seed",
          board: {
            id: "board-1",
            name: "Creative Lab",
            description: "Discussion space for practical prompting systems.",
            rules: [
              {
                title: "Stay concrete",
                description: "A".repeat(700),
              },
            ],
          },
        }),
        loadCommentSource: async () => null,
        listRecentBoardPosts: async () =>
          Array.from({ length: 12 }, (_, index) => ({
            id: `post-${index + 1}`,
            title: `Recent board post ${index + 1}`,
          })),
        listRecentTopLevelComments: async () => [],
      },
    });

    const result = await builder.build({
      task: buildTask({
        taskType: "post",
        sourceTable: "posts",
        sourceId: "post-1",
        payload: {
          summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
        },
      }),
    });

    expect(result.taskType).toBe("post");
    expect(result.flowKind).toBe("post");
    expect(result.taskContext).toContain("Generate a new post for the board below.");
    expect(result.taskContext).not.toContain("Original task summary");
    expect(result.boardContextText).toContain("Name: Creative Lab");
    expect(result.targetContextText).toContain("[recent_board_posts]");
    expect(result.targetContextText).toContain(
      "Do not reuse, lightly paraphrase, or closely mirror titles like these.",
    );
    expect(result.targetContextText).toContain("Recent board post 1");
    expect(result.targetContextText).toContain("Recent board post 10");
    expect(result.targetContextText).not.toContain("Recent board post 11");

    const rulesText = result.boardContextText?.split("Rules:\n")[1] ?? "";
    expect(rulesText.length).toBeLessThanOrEqual(600);
  });

  it("builds top-level comment flow from a post source with root post and recent top-level comments only", async () => {
    const builder = new AiAgentPersonaTaskContextBuilder({
      deps: {
        loadPostSource: async () => ({
          id: "post-1",
          title: "Best prompting workflows this week",
          body: "Body of the root post.",
          board: {
            id: "board-1",
            name: "Creative Lab",
            description: "Discussion space for practical prompting systems.",
            rules: [],
          },
        }),
        loadCommentSource: async () => null,
        listRecentBoardPosts: async () => [],
        listRecentTopLevelComments: async () =>
          Array.from({ length: 12 }, (_, index) => ({
            id: `comment-${index + 1}`,
            authorName: `artist_${index + 1}`,
            body: `Top-level comment ${index + 1}`,
            parentId: null,
            postId: "post-1",
          })),
      },
    });

    const result = await builder.build({
      task: buildTask({
        taskType: "comment",
        sourceTable: "posts",
        sourceId: "post-1",
      }),
    });

    expect(result.taskType).toBe("comment");
    expect(result.flowKind).toBe("comment");
    expect(result.taskContext).toContain("top-level contribution");
    expect(result.targetContextText).toContain("[root_post]");
    expect(result.targetContextText).toContain("[recent_top_level_comments]");
    expect(result.targetContextText).not.toContain("[source_comment]");
    expect(result.targetContextText).not.toContain("[ancestor_comments]");
    expect(result.targetContextText).toContain("[artist_1]: Top-level comment 1");
    expect(result.targetContextText).toContain("[artist_10]: Top-level comment 10");
    expect(result.targetContextText).not.toContain("[artist_11]: Top-level comment 11");
  });

  it("preserves story contentMode for top-level comment and thread-reply task-context text", async () => {
    const builder = new AiAgentPersonaTaskContextBuilder({
      deps: {
        loadPostSource: async (postId) => ({
          id: postId,
          title: "Story root",
          body: "A story-mode root post body.",
          board: null,
        }),
        loadCommentSource: async (commentId) => {
          if (commentId !== "comment-7") {
            return null;
          }
          return {
            id: "comment-7",
            body: "Continue the scene here.",
            parentId: null,
            postId: "post-story",
            authorName: "artist_7",
            post: {
              id: "post-story",
              title: "Story root",
              body: "A story-mode root post body.",
              board: null,
            },
          };
        },
        listRecentBoardPosts: async () => [],
        listRecentTopLevelComments: async () => [],
      },
    });

    const topLevelComment = await builder.build({
      task: buildTask({
        taskType: "comment",
        sourceTable: "posts",
        sourceId: "post-story",
        payload: { contentMode: "story" },
      }),
    });
    const threadReply = await builder.build({
      task: buildTask({
        taskType: "comment",
        sourceTable: "comments",
        sourceId: "comment-7",
        payload: { contentMode: "story" },
      }),
    });

    expect(topLevelComment.flowKind).toBe("comment");
    expect(topLevelComment.taskContext).toContain("Generate a comment for the discussion below.");

    expect(threadReply.flowKind).toBe("reply");
    expect(threadReply.taskContext).toContain("Generate a reply inside the active thread below.");
  });

  it("builds thread-reply flow with earliest-to-nearest ancestors, deduped top-level comments, and bounded root-post body", async () => {
    const builder = new AiAgentPersonaTaskContextBuilder({
      deps: {
        loadPostSource: async () => null,
        loadCommentSource: async (commentId) => {
          if (commentId === "comment-3") {
            return {
              id: "comment-3",
              body: "This still sounds too vague. What exactly changes in the workflow if you add a repair step?",
              parentId: "comment-2",
              postId: "post-1",
              authorName: "artist_3",
              post: {
                id: "post-1",
                title: "Best prompting workflows this week",
                body: "B".repeat(900),
                board: {
                  id: "board-1",
                  name: "Creative Lab",
                  description: "Discussion space for practical prompting systems.",
                  rules: [],
                },
              },
            };
          }
          if (commentId === "comment-2") {
            return {
              id: "comment-2",
              body: "Right, and that makes it hard to tell whether the prompt was actually robust.",
              parentId: "comment-1",
              postId: "post-1",
              authorName: "ai_marlowe",
              post: null,
            };
          }
          if (commentId === "comment-1") {
            return {
              id: "comment-1",
              body: "Prompt review is useful, but most examples stop before runtime execution.",
              parentId: null,
              postId: "post-1",
              authorName: "artist_1",
              post: null,
            };
          }
          return null;
        },
        listRecentBoardPosts: async () => [],
        listRecentTopLevelComments: async () => [
          {
            id: "comment-1",
            authorName: "artist_1",
            body: "Prompt review is useful, but most examples stop before runtime execution.",
            parentId: null,
            postId: "post-1",
          },
          {
            id: "comment-9",
            authorName: "artist_5",
            body: "The post itself is useful, but I still want one concrete example from a live queue.",
            parentId: null,
            postId: "post-1",
          },
          {
            id: "comment-10",
            authorName: "ai_orchid",
            body: "I think the key comparison is malformed output versus accepted repaired output.",
            parentId: null,
            postId: "post-1",
          },
        ],
      },
    });

    const result = await builder.build({
      task: buildTask({
        taskType: "comment",
        sourceTable: "comments",
        sourceId: "comment-3",
      }),
    });

    const targetContext = result.targetContextText ?? "";
    expect(result.flowKind).toBe("reply");
    expect(result.taskContext).toContain("Generate a reply inside the active thread below.");
    expect(targetContext).toContain("[source_comment]");
    expect(targetContext).toContain("[ancestor_comments]");
    expect(targetContext).toContain("[recent_top_level_comments]");
    expect(targetContext).toContain("[root_post]");

    const rootPostStart = targetContext.indexOf("[root_post]");
    const sourceStart = targetContext.indexOf("[source_comment]");
    expect(rootPostStart).toBeGreaterThanOrEqual(0);
    expect(rootPostStart).toBeLessThan(sourceStart);

    const ancestorStart = targetContext.indexOf("[ancestor_comments]");
    const recentStart = targetContext.indexOf("[recent_top_level_comments]");
    const ancestorsSection = targetContext.slice(ancestorStart, recentStart);
    expect(ancestorsSection.indexOf("[artist_1]:")).toBeLessThan(
      ancestorsSection.indexOf("[ai_marlowe]:"),
    );

    expect(targetContext).not.toContain(
      "[artist_1]: Prompt review is useful, but most examples stop before runtime execution.\n\n[recent_top_level_comments]",
    );
    expect(targetContext).not.toMatch(
      /\[recent_top_level_comments\][\s\S]*\[artist_1\]: Prompt review is useful, but most examples stop before runtime execution\./,
    );
    expect(targetContext).toContain(
      "[artist_5]: The post itself is useful, but I still want one concrete example from a live queue.",
    );

    const rootBodyMatch = targetContext.match(
      /\[root_post\][\s\S]*?Body excerpt:\n([\s\S]*?)(?:\n\n\[[^\]]+\]|$)/,
    );
    expect(rootBodyMatch?.[1]?.length ?? 0).toBeLessThanOrEqual(800);
  });

  it("caps source-comment and comment-thread excerpts to the approved lengths", async () => {
    const sourceBody = "S".repeat(260);
    const ancestorBody = "A".repeat(240);
    const topLevelBody = "T".repeat(230);
    const builder = new AiAgentPersonaTaskContextBuilder({
      deps: {
        loadPostSource: async () => null,
        loadCommentSource: async (commentId) => {
          if (commentId === "comment-3") {
            return {
              id: "comment-3",
              body: sourceBody,
              parentId: "comment-2",
              postId: "post-1",
              authorName: "artist_3",
              post: {
                id: "post-1",
                title: "Best prompting workflows this week",
                body: "root body",
                board: {
                  id: "board-1",
                  name: "Creative Lab",
                  description: "Discussion space for practical prompting systems.",
                  rules: [],
                },
              },
            };
          }
          if (commentId === "comment-2") {
            return {
              id: "comment-2",
              body: ancestorBody,
              parentId: null,
              postId: "post-1",
              authorName: "ai_marlowe",
              post: null,
            };
          }
          return null;
        },
        listRecentBoardPosts: async () => [],
        listRecentTopLevelComments: async () => [
          {
            id: "comment-9",
            authorName: "artist_5",
            body: topLevelBody,
            parentId: null,
            postId: "post-1",
          },
        ],
      },
    });

    const result = await builder.build({
      task: buildTask({
        taskType: "comment",
        sourceTable: "comments",
        sourceId: "comment-3",
      }),
    });

    const targetContext = result.targetContextText ?? "";
    const sourceLine = targetContext.match(/\[source_comment\]\n([^\n]+)/)?.[1] ?? "";
    const ancestorLine = targetContext.match(/\[ancestor_comments\]\n([^\n]+)/)?.[1] ?? "";
    const topLevelLine = targetContext.match(/\[recent_top_level_comments\]\n([^\n]+)/)?.[1] ?? "";

    expect(extractCommentExcerpt(sourceLine)).toHaveLength(220);
    expect(extractCommentExcerpt(sourceLine).endsWith("...")).toBe(true);
    expect(extractCommentExcerpt(ancestorLine)).toHaveLength(180);
    expect(extractCommentExcerpt(ancestorLine).endsWith("...")).toBe(true);
    expect(extractCommentExcerpt(topLevelLine)).toHaveLength(180);
    expect(extractCommentExcerpt(topLevelLine).endsWith("...")).toBe(true);
  });
});
