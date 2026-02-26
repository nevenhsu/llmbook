import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { ReplyGenerator } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import { GeneratorSkipReasonCode } from "@/lib/ai/reason-codes";
import type { ModelAdapter } from "@/lib/ai/prompt-runtime/model-adapter";
import {
  buildRuntimeSoulProfile,
  recordRuntimeSoulApplied,
  type RuntimeSoulContext,
} from "@/lib/ai/soul/runtime-soul-profile";
import { buildRuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { generateReplyTextWithPromptRuntime } from "@/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime";
import {
  CachedReplyPolicyProvider,
  type ReplyPolicyProvider,
} from "@/lib/ai/policy/policy-control-plane";

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

function toSentenceCase(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function resolveRhythmLead(rhythm: string): string {
  const normalized = rhythm.toLowerCase();
  if (normalized.includes("direct")) {
    return "Directly speaking,";
  }
  if (normalized.includes("calm") || normalized.includes("gentle")) {
    return "Calmly,";
  }
  if (normalized.includes("structured")) {
    return "In a structured way,";
  }
  return "Concisely,";
}

function resolveStanceLine(input: RuntimeSoulContext): string {
  const stance = input.summary.collaborationStance.toLowerCase();
  const topValue = input.summary.topValues[0] ?? "clarity";
  const tradeoffStyle = toSentenceCase(input.summary.tradeoffStyle.toLowerCase());

  if (stance.includes("challenge")) {
    return `I will challenge assumptions first and prioritize ${topValue}; trade-offs follow a ${tradeoffStyle} style.`;
  }
  if (stance.includes("support")) {
    return `I will support momentum while protecting ${topValue}; trade-offs follow a ${tradeoffStyle} style.`;
  }
  return `I will coach toward a concrete next step with ${topValue} first; trade-offs follow a ${tradeoffStyle} style.`;
}

function resolveCloseLine(input: RuntimeSoulContext): string {
  const askVsTell = input.profile.interactionDoctrine.askVsTellRatio.toLowerCase();
  const uncertaintyHandling = toSentenceCase(input.profile.decisionPolicy.uncertaintyHandling);
  if (askVsTell.includes("ask")) {
    return `${uncertaintyHandling}. Which constraint matters most for your next move?`;
  }
  return `${uncertaintyHandling}. Start with one measurable next step and validate quickly.`;
}

export function composeSoulDrivenReply(input: {
  title: string;
  postBodySnippet: string;
  focusActor: string;
  focusSnippet: string | null;
  participantCount: number;
  soul: RuntimeSoulContext;
}): string {
  const lines = [
    `${resolveRhythmLead(input.soul.summary.rhythm)} I read the discussion on **${input.title}** through this lens: ${input.soul.summary.identity}.`,
    input.focusSnippet
      ? `${input.focusActor} raised: "${input.focusSnippet}".`
      : `I want to add to the main post context.`,
    input.participantCount > 2
      ? `${resolveStanceLine(input.soul)} There are multiple perspectives here, so I will keep the reply concrete.`
      : `${resolveStanceLine(input.soul)} I will keep this directly relevant.`,
    input.postBodySnippet
      ? `Based on the post context, a practical next step is to clarify assumptions and compare options. ${resolveCloseLine(
          input.soul,
        )}`
      : `A practical next step is to state assumptions before deciding. ${resolveCloseLine(
          input.soul,
        )}`,
  ];

  // Keep output markdown-friendly (no raw HTML), compatible with TipTap markdown storage.
  return `${lines[0]}\n\n${lines[1]}\n\n${lines[2]} ${lines[3]}`;
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
  private readonly loadRuntimeSoul: typeof buildRuntimeSoulProfile;
  private readonly recordSoulApplied: typeof recordRuntimeSoulApplied;
  private readonly loadRuntimeMemory: typeof buildRuntimeMemoryContext;
  private readonly modelAdapter?: ModelAdapter;
  private readonly policyProvider: ReplyPolicyProvider;

  public constructor(options?: {
    loadRuntimeSoul?: typeof buildRuntimeSoulProfile;
    recordSoulApplied?: typeof recordRuntimeSoulApplied;
    loadRuntimeMemory?: typeof buildRuntimeMemoryContext;
    modelAdapter?: ModelAdapter;
    policyProvider?: ReplyPolicyProvider;
  }) {
    this.loadRuntimeSoul = options?.loadRuntimeSoul ?? buildRuntimeSoulProfile;
    this.recordSoulApplied = options?.recordSoulApplied ?? recordRuntimeSoulApplied;
    this.loadRuntimeMemory = options?.loadRuntimeMemory ?? buildRuntimeMemoryContext;
    this.modelAdapter = options?.modelAdapter;
    this.policyProvider = options?.policyProvider ?? new CachedReplyPolicyProvider();
  }

  public async generate(task: QueueTask): Promise<{
    text?: string;
    parentCommentId?: string;
    skipReason?: string;
    safetyContext?: { recentPersonaReplies: string[] };
  }> {
    const postId = typeof task.payload.postId === "string" ? task.payload.postId : null;
    if (!postId) {
      return { skipReason: GeneratorSkipReasonCode.missingPostId };
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
      return { skipReason: GeneratorSkipReasonCode.postLoadFailed };
    }

    const { data: comments, error: commentError } = await supabase
      .from("comments")
      .select("id, post_id, parent_id, author_id, persona_id, body, created_at")
      .eq("post_id", postId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(maxComments);

    if (commentError) {
      return { skipReason: GeneratorSkipReasonCode.commentLoadFailed };
    }

    const { data: recentReplies, error: recentReplyError } = await supabase
      .from("comments")
      .select("body")
      .eq("post_id", postId)
      .eq("persona_id", task.personaId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentReplyError) {
      return { skipReason: GeneratorSkipReasonCode.recentReplyLoadFailed };
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
      return { skipReason: GeneratorSkipReasonCode.noEligibleTargetAvoidSelfTalk };
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
    const soul = await this.loadRuntimeSoul({ personaId: task.personaId, tolerateFailure: true });
    const threadId = typeof task.payload.threadId === "string" ? task.payload.threadId : undefined;
    const boardId = typeof task.payload.boardId === "string" ? task.payload.boardId : undefined;

    let memoryContext = null;
    try {
      memoryContext = await this.loadRuntimeMemory({
        personaId: task.personaId,
        threadId,
        boardId,
        taskType: "reply",
        now: new Date(),
        tolerateFailure: true,
      });
    } catch {
      memoryContext = null;
    }

    try {
      await this.recordSoulApplied({
        personaId: task.personaId,
        layer: "generation",
        metadata: {
          source: soul.source,
          normalized: soul.normalized,
          riskPreference: soul.summary.riskPreference,
          tradeoffStyle: soul.summary.tradeoffStyle,
        },
      });
    } catch {
      // Best-effort observability only.
    }

    const runtimeResult = await generateReplyTextWithPromptRuntime({
      entityId: task.id,
      personaId: task.personaId,
      postId,
      title,
      postBodySnippet,
      focusActor,
      focusSnippet,
      participantCount,
      soul,
      memoryContext,
      policy: await this.policyProvider.getReplyPolicy({
        personaId: task.personaId,
        boardId,
      }),
      modelAdapter: this.modelAdapter,
    });

    return {
      text: runtimeResult.text,
      parentCommentId: focusComment?.id,
      safetyContext: {
        recentPersonaReplies: (recentReplies ?? [])
          .map((row) => normalizeText(String((row as { body?: string | null }).body ?? "")))
          .filter((body) => body.length > 0)
          .slice(0, 10),
      },
    };
  }
}
