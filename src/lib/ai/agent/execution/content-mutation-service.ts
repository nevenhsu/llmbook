import { createAdminClient } from "@/lib/supabase/admin";

type TagRow = {
  id: string;
  name: string;
  slug: string;
};

type PostTagJoinRow = {
  tag: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
};

type PostTargetRow = {
  id: string;
  title: string;
  body: string;
  post_tags: PostTagJoinRow[] | null;
};

type CommentTargetRow = {
  id: string;
  body: string;
};

type ContentEditHistoryRow = {
  id: string;
};

export type AiAgentContentTargetType = "post" | "comment";

export type AiAgentContentPreviousSnapshot =
  | {
      schema_version: 1;
      title: string;
      body: string;
      tags: string[];
    }
  | {
      schema_version: 1;
      body: string;
    };

export type AiAgentContentMutationInput =
  | {
      targetType: "post";
      targetId: string;
      nextContent: {
        title: string;
        body: string;
        tags: string[];
      };
      jobTaskId?: string | null;
      sourceRuntime: string;
      sourceKind: string;
      sourceId?: string | null;
      modelMetadata?: Record<string, unknown>;
      createdBy?: string | null;
    }
  | {
      targetType: "comment";
      targetId: string;
      nextContent: {
        body: string;
      };
      jobTaskId?: string | null;
      sourceRuntime: string;
      sourceKind: string;
      sourceId?: string | null;
      modelMetadata?: Record<string, unknown>;
      createdBy?: string | null;
    };

export type AiAgentContentMutationResult = {
  targetType: AiAgentContentTargetType;
  targetId: string;
  historyId: string;
  previousSnapshot: AiAgentContentPreviousSnapshot;
  updatedAt: string;
};

type ContentMutationServiceDeps = {
  loadPostTarget: (postId: string) => Promise<PostTargetRow | null>;
  loadCommentTarget: (commentId: string) => Promise<CommentTargetRow | null>;
  insertHistory: (input: {
    targetType: AiAgentContentTargetType;
    targetId: string;
    jobTaskId: string | null;
    sourceRuntime: string;
    sourceKind: string;
    sourceId: string | null;
    previousSnapshot: AiAgentContentPreviousSnapshot;
    modelMetadata: Record<string, unknown>;
    createdBy: string | null;
  }) => Promise<ContentEditHistoryRow>;
  deleteHistory: (historyId: string) => Promise<void>;
  updatePost: (input: {
    postId: string;
    title: string;
    body: string;
    updatedAt: string;
  }) => Promise<void>;
  updateComment: (input: { commentId: string; body: string; updatedAt: string }) => Promise<void>;
  resolveTagIds: (tagNames: string[]) => Promise<string[]>;
  replacePostTags: (input: { postId: string; tagIds: string[] }) => Promise<void>;
  now: () => Date;
};

function normalizeTargetTags(rows: PostTargetRow["post_tags"]): string[] {
  return (rows ?? [])
    .flatMap((row) => {
      if (Array.isArray(row.tag)) {
        return row.tag;
      }
      return row.tag ? [row.tag] : [];
    })
    .map((tag) => tag.name.trim())
    .filter((name) => name.length > 0);
}

function normalizeNewTagNames(tagNames: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tagName of tagNames) {
    const trimmed = tagName.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function buildPostSnapshot(
  row: PostTargetRow,
): Extract<AiAgentContentPreviousSnapshot, { title: string }> {
  return {
    schema_version: 1,
    title: row.title,
    body: row.body,
    tags: normalizeTargetTags(row.post_tags),
  };
}

function buildCommentSnapshot(
  row: CommentTargetRow,
): Extract<AiAgentContentPreviousSnapshot, { body: string }> {
  return {
    schema_version: 1,
    body: row.body,
  };
}

function slugifyTagName(tagName: string): string {
  const trimmed = tagName.trim().toLowerCase();
  const slug = trimmed
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || trimmed;
}

export class AiAgentContentMutationService {
  private readonly deps: ContentMutationServiceDeps;

  public constructor(options?: { deps?: Partial<ContentMutationServiceDeps> }) {
    this.deps = {
      loadPostTarget:
        options?.deps?.loadPostTarget ??
        (async (postId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("posts")
            .select("id, title, body, post_tags(tag:tags(name, slug))")
            .eq("id", postId)
            .maybeSingle<PostTargetRow>();

          if (error) {
            throw new Error(`load post rewrite target failed: ${error.message}`);
          }

          return data ?? null;
        }),
      loadCommentTarget:
        options?.deps?.loadCommentTarget ??
        (async (commentId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("comments")
            .select("id, body")
            .eq("id", commentId)
            .maybeSingle<CommentTargetRow>();

          if (error) {
            throw new Error(`load comment rewrite target failed: ${error.message}`);
          }

          return data ?? null;
        }),
      insertHistory:
        options?.deps?.insertHistory ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("content_edit_history")
            .insert({
              target_type: input.targetType,
              target_id: input.targetId,
              job_task_id: input.jobTaskId,
              source_runtime: input.sourceRuntime,
              source_kind: input.sourceKind,
              source_id: input.sourceId,
              previous_snapshot: input.previousSnapshot,
              model_metadata: input.modelMetadata,
              created_by: input.createdBy,
            })
            .select("id")
            .single<ContentEditHistoryRow>();

          if (error || !data) {
            throw new Error(
              `insert content_edit_history failed: ${error?.message ?? "missing row"}`,
            );
          }

          return data;
        }),
      deleteHistory:
        options?.deps?.deleteHistory ??
        (async (historyId) => {
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("content_edit_history")
            .delete()
            .eq("id", historyId);
          if (error) {
            throw new Error(`delete content_edit_history failed: ${error.message}`);
          }
        }),
      updatePost:
        options?.deps?.updatePost ??
        (async (input) => {
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("posts")
            .update({
              title: input.title,
              body: input.body,
              updated_at: input.updatedAt,
            })
            .eq("id", input.postId);

          if (error) {
            throw new Error(`update rewritten post failed: ${error.message}`);
          }
        }),
      updateComment:
        options?.deps?.updateComment ??
        (async (input) => {
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("comments")
            .update({
              body: input.body,
              updated_at: input.updatedAt,
            })
            .eq("id", input.commentId);

          if (error) {
            throw new Error(`update rewritten comment failed: ${error.message}`);
          }
        }),
      resolveTagIds:
        options?.deps?.resolveTagIds ??
        (async (tagNames) => {
          const normalizedTagNames = normalizeNewTagNames(tagNames);
          if (normalizedTagNames.length === 0) {
            return [];
          }

          const supabase = createAdminClient();
          const { data: existingRows, error: existingError } = await supabase
            .from("tags")
            .select("id, name, slug")
            .in("name", normalizedTagNames)
            .returns<TagRow[]>();

          if (existingError) {
            throw new Error(`load rewrite tags failed: ${existingError.message}`);
          }

          const tagIdByName = new Map(
            (existingRows ?? []).map((row) => [row.name, row.id] as const),
          );

          for (const tagName of normalizedTagNames) {
            if (tagIdByName.has(tagName)) {
              continue;
            }

            const { data, error } = await supabase
              .from("tags")
              .insert({
                name: tagName,
                slug: slugifyTagName(tagName),
              })
              .select("id, name, slug")
              .single<TagRow>();

            if (error || !data) {
              throw new Error(`create rewrite tag failed: ${error?.message ?? "missing row"}`);
            }

            tagIdByName.set(data.name, data.id);
          }

          return normalizedTagNames.flatMap((tagName) => {
            const tagId = tagIdByName.get(tagName);
            return tagId ? [tagId] : [];
          });
        }),
      replacePostTags:
        options?.deps?.replacePostTags ??
        (async (input) => {
          const supabase = createAdminClient();
          const { error: deleteError } = await supabase
            .from("post_tags")
            .delete()
            .eq("post_id", input.postId);

          if (deleteError) {
            throw new Error(`clear rewritten post tags failed: ${deleteError.message}`);
          }

          if (input.tagIds.length === 0) {
            return;
          }

          const { error: insertError } = await supabase.from("post_tags").insert(
            input.tagIds.map((tagId) => ({
              post_id: input.postId,
              tag_id: tagId,
            })),
          );

          if (insertError) {
            throw new Error(`save rewritten post tags failed: ${insertError.message}`);
          }
        }),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async overwriteContent(
    input: AiAgentContentMutationInput,
  ): Promise<AiAgentContentMutationResult> {
    const updatedAt = this.deps.now().toISOString();

    if (input.targetType === "post") {
      const currentPost = await this.deps.loadPostTarget(input.targetId);
      if (!currentPost) {
        throw new Error("rewrite target post not found");
      }

      const previousSnapshot = buildPostSnapshot(currentPost);
      const history = await this.deps.insertHistory({
        targetType: "post",
        targetId: currentPost.id,
        jobTaskId: input.jobTaskId ?? null,
        sourceRuntime: input.sourceRuntime,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId ?? null,
        previousSnapshot,
        modelMetadata: input.modelMetadata ?? {},
        createdBy: input.createdBy ?? null,
      });

      try {
        const tagIds = await this.deps.resolveTagIds(input.nextContent.tags);
        await this.deps.updatePost({
          postId: currentPost.id,
          title: input.nextContent.title.trim(),
          body: input.nextContent.body.trim(),
          updatedAt,
        });
        await this.deps.replacePostTags({
          postId: currentPost.id,
          tagIds,
        });
      } catch (error) {
        await this.deleteHistoryBestEffort(history.id);
        throw error;
      }

      return {
        targetType: "post",
        targetId: currentPost.id,
        historyId: history.id,
        previousSnapshot,
        updatedAt,
      };
    }

    const currentComment = await this.deps.loadCommentTarget(input.targetId);
    if (!currentComment) {
      throw new Error("rewrite target comment not found");
    }

    const previousSnapshot = buildCommentSnapshot(currentComment);
    const history = await this.deps.insertHistory({
      targetType: "comment",
      targetId: currentComment.id,
      jobTaskId: input.jobTaskId ?? null,
      sourceRuntime: input.sourceRuntime,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId ?? null,
      previousSnapshot,
      modelMetadata: input.modelMetadata ?? {},
      createdBy: input.createdBy ?? null,
    });

    try {
      await this.deps.updateComment({
        commentId: currentComment.id,
        body: input.nextContent.body.trim(),
        updatedAt,
      });
    } catch (error) {
      await this.deleteHistoryBestEffort(history.id);
      throw error;
    }

    return {
      targetType: "comment",
      targetId: currentComment.id,
      historyId: history.id,
      previousSnapshot,
      updatedAt,
    };
  }

  private async deleteHistoryBestEffort(historyId: string): Promise<void> {
    try {
      await this.deps.deleteHistory(historyId);
    } catch {
      // Best effort only; surface the original mutation failure.
    }
  }
}
