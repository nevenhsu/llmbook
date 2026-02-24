import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { ReplyGenerator } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";

type PostRow = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  persona_id: string | null;
  created_at: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  persona_id: string | null;
  body: string;
  created_at: string;
};

type RankedComment = CommentRow & {
  rankPriority: number;
  rankTime: number;
};

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function shortId(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.slice(0, 8);
}

function actorLabel(row: { author_id: string | null; persona_id: string | null }): string {
  if (row.author_id) {
    return `user:${shortId(row.author_id)}`;
  }
  if (row.persona_id) {
    return `persona:${shortId(row.persona_id)}`;
  }
  return "unknown";
}

function toEpoch(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function rankFocusCandidates(input: {
  comments: CommentRow[];
  personaId: string;
}): CommentRow[] {
  const ranked: RankedComment[] = input.comments
    .map((comment) => {
      const isSelf = comment.persona_id === input.personaId;
      return {
        ...comment,
        rankPriority: isSelf ? 0 : 1,
        rankTime: toEpoch(comment.created_at),
      };
    })
    .sort(
      (a, b) =>
        b.rankPriority - a.rankPriority || b.rankTime - a.rankTime || b.id.localeCompare(a.id),
    );

  return ranked;
}

export class SupabaseTemplateReplyGenerator implements ReplyGenerator {
  public async generate(task: QueueTask): Promise<{
    text?: string;
    parentCommentId?: string;
    skipReason?: string;
    safetyContext?: { recentPersonaReplies: string[] };
  }> {
    const postId = typeof task.payload.postId === "string" ? task.payload.postId : null;
    if (!postId) {
      return { skipReason: "MISSING_POST_ID" };
    }

    const requestedParentCommentId =
      typeof task.payload.parentCommentId === "string" ? task.payload.parentCommentId : null;

    const maxComments =
      typeof task.payload.contextCommentLimit === "number" && task.payload.contextCommentLimit > 0
        ? Math.min(task.payload.contextCommentLimit, 120)
        : 40;

    const supabase = createAdminClient();
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, title, body, author_id, persona_id, created_at")
      .eq("id", postId)
      .single<PostRow>();

    if (postError) {
      return { skipReason: `POST_LOAD_FAILED:${postError.message}` };
    }

    const { data: comments, error: commentError } = await supabase
      .from("comments")
      .select("id, post_id, parent_id, author_id, persona_id, body, created_at")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(maxComments);

    if (commentError) {
      return { skipReason: `COMMENT_LOAD_FAILED:${commentError.message}` };
    }

    const commentRows = (comments ?? []) as CommentRow[];
    const isSelfByPersona = (row: { persona_id: string | null }): boolean =>
      row.persona_id === task.personaId;

    let focusComment: CommentRow | undefined;

    const rankedCandidates = rankFocusCandidates({
      comments: commentRows,
      personaId: task.personaId,
    });

    const requestedNonSelf =
      requestedParentCommentId != null
        ? rankedCandidates.find(
            (candidate) => candidate.id === requestedParentCommentId && !isSelfByPersona(candidate),
          )
        : undefined;
    const newestNonSelf = rankedCandidates.find((candidate) => !isSelfByPersona(candidate));

    if (newestNonSelf) {
      focusComment = newestNonSelf;
    } else if (requestedNonSelf) {
      focusComment = requestedNonSelf;
    }

    if (!focusComment && post.persona_id === task.personaId) {
      return { skipReason: "NO_ELIGIBLE_TARGET_AVOID_SELF_TALK" };
    }

    const title = normalizeText(post.title || "this post");
    const postBodySnippet = normalizeText(post.body || "").slice(0, 180);

    const participants = new Set<string>();
    participants.add(actorLabel(post));
    for (const row of commentRows) {
      participants.add(actorLabel(row));
    }

    const focusSnippet = focusComment ? normalizeText(focusComment.body).slice(0, 120) : null;
    const focusActor = focusComment ? actorLabel(focusComment) : actorLabel(post);
    const participantCount = participants.size;

    const lines = [
      `I read the discussion on **${title}**.`,
      focusSnippet
        ? `${focusActor} raised: "${focusSnippet}".`
        : `I want to add to the main post context.`,
      participantCount > 2
        ? `There are multiple perspectives in this thread, so I will keep this focused and concrete.`
        : `I will keep this concise and directly relevant.`,
      postBodySnippet
        ? `Based on the post context, one practical next step is to clarify assumptions and compare trade-offs.`
        : `A practical next step is to state assumptions and compare trade-offs before deciding.`,
    ];

    // Keep output markdown-friendly (no raw HTML), compatible with TipTap markdown storage.
    const text = `${lines[0]}\n\n${lines[1]}\n\n${lines[2]} ${lines[3]}`;

    return {
      text,
      parentCommentId: focusComment?.id,
      safetyContext: {
        recentPersonaReplies: rankedCandidates
          .filter((candidate) => isSelfByPersona(candidate))
          .map((candidate) => normalizeText(candidate.body))
          .filter((body) => body.length > 0)
          .slice(0, 5),
      },
    };
  }
}
