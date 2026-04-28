import type { PromptBoardRule } from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import { createAdminClient } from "@/lib/supabase/admin";

type BoardSource = {
  id: string;
  name: string | null;
  description: string | null;
  rules: PromptBoardRule[] | null;
};

type PostSource = {
  id: string;
  title: string;
  body: string;
  board: BoardSource | null;
};

type CommentSource = {
  id: string;
  body: string;
  parentId: string | null;
  postId: string;
  authorName: string;
  post: PostSource | null;
};

type RecentBoardPost = {
  id: string;
  title: string;
};

type RecentTopLevelComment = {
  id: string;
  body: string;
  parentId: string | null;
  postId: string;
  authorName: string;
};

type RawBoardRow = {
  id?: string;
  name?: string | null;
  description?: string | null;
  rules?: unknown;
};

type RawPostRow = {
  id: string;
  title: string;
  body: string;
  boards: RawBoardRow | RawBoardRow[] | null;
};

type RawProfileIdentity = {
  username?: string | null;
  display_name?: string | null;
};

type RawCommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  persona_id?: string | null;
  profiles?: RawProfileIdentity | RawProfileIdentity[] | null;
  personas?: RawProfileIdentity | RawProfileIdentity[] | null;
  posts?:
    | {
        id?: string;
        title?: string | null;
        body?: string | null;
        boards?: RawBoardRow | RawBoardRow[] | null;
      }
    | Array<{
        id?: string;
        title?: string | null;
        body?: string | null;
        boards?: RawBoardRow | RawBoardRow[] | null;
      }>
    | null;
};

type AiAgentPersonaTaskContextBuilderDeps = {
  loadPostSource: (postId: string) => Promise<PostSource | null>;
  loadCommentSource: (commentId: string) => Promise<CommentSource | null>;
  listRecentBoardPosts: (boardId: string) => Promise<RecentBoardPost[]>;
  listRecentTopLevelComments: (postId: string) => Promise<RecentTopLevelComment[]>;
};

export type AiAgentPersonaTaskPromptContext = {
  flowKind: "post" | "comment" | "reply";
  taskType: "post" | "comment";
  taskContext: string;
  boardContextText?: string;
  targetContextText?: string;
};

const BOARD_RULES_MAX_CHARS = 600;
const ROOT_POST_BODY_MAX_CHARS = 800;
const SOURCE_COMMENT_EXCERPT_MAX_CHARS = 220;
const COMMENT_EXCERPT_MAX_CHARS = 180;
const RECENT_BOARD_POST_TITLE_MAX_CHARS = 120;
const RECENT_BOARD_POST_LIMIT = 10;
const RECENT_TOP_LEVEL_COMMENT_LIMIT = 10;
const RECENT_TOP_LEVEL_COMMENT_FETCH_LIMIT = 20;
const ANCESTOR_COMMENT_LIMIT = 10;

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function resolveFlowKind(task: AiAgentRecentTaskSnapshot): "post" | "comment" | "reply" {
  if (task.taskType === "post") {
    return "post";
  }
  if (task.taskType === "reply") {
    return "reply";
  }

  const sourceCommentId = resolveTaskCommentId(task);
  return sourceCommentId ? "reply" : "comment";
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function truncateText(input: string, maxChars: number): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars <= 3) {
    return trimmed.slice(0, maxChars);
  }
  return `${trimmed.slice(0, maxChars - 3).trimEnd()}...`;
}

function truncateInlineText(input: string, maxChars: number): string {
  return truncateText(normalizeWhitespace(input), maxChars);
}

function parseBoardRules(input: unknown): PromptBoardRule[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const rules = input
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const record = item as { title?: unknown; description?: unknown };
      if (typeof record.title !== "string" || record.title.trim().length === 0) {
        return null;
      }
      const nextRule: PromptBoardRule = {
        title: record.title.trim(),
        description:
          typeof record.description === "string" && record.description.trim().length > 0
            ? record.description.trim()
            : null,
      };
      return nextRule;
    })
    .filter((rule): rule is PromptBoardRule => rule !== null);

  return rules.length > 0 ? rules : null;
}

function mapBoardSource(board: RawBoardRow | RawBoardRow[] | null | undefined): BoardSource | null {
  const value = asSingle(board);
  if (!value?.id) {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : null,
    description: typeof value.description === "string" ? value.description : null,
    rules: parseBoardRules(value.rules),
  };
}

function buildBoardContextText(board: BoardSource | null): string | undefined {
  if (!board) {
    return undefined;
  }

  const ruleLines =
    board.rules?.map((rule) => {
      const title = normalizeWhitespace(rule.title);
      const description = rule.description ? normalizeWhitespace(rule.description) : null;
      return description ? `- ${title}: ${description}` : `- ${title}`;
    }) ?? [];
  const mergedRules =
    ruleLines.length > 0 ? truncateText(ruleLines.join("\n"), BOARD_RULES_MAX_CHARS) : null;

  const lines = [
    board.name?.trim() ? `Name: ${board.name.trim()}` : null,
    board.description?.trim() ? `Description: ${board.description.trim()}` : null,
    mergedRules ? `Rules:\n${mergedRules}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : undefined;
}

function buildRecentBoardPostsBlock(posts: RecentBoardPost[]): string {
  const titles = posts
    .slice(0, RECENT_BOARD_POST_LIMIT)
    .map((post) => `- ${truncateInlineText(post.title, RECENT_BOARD_POST_TITLE_MAX_CHARS)}`);

  return [
    "[recent_board_posts]",
    "Do not reuse, lightly paraphrase, or closely mirror titles like these.",
    "Use them as anti-duplication references and push toward a genuinely extended angle.",
    titles.length > 0
      ? titles.join("\n")
      : "No recent published board post titles are available for anti-duplication checks.",
  ].join("\n");
}

function buildCommentLine(authorName: string, body: string, maxChars: number): string {
  const safeName = normalizeWhitespace(authorName) || "unknown";
  return `[${safeName}]: ${truncateInlineText(body, maxChars)}`;
}

function buildRootPostBlock(post: PostSource): string {
  return [
    "[root_post]",
    `Title: ${normalizeWhitespace(post.title)}`,
    "Body excerpt:",
    truncateText(post.body, ROOT_POST_BODY_MAX_CHARS),
  ].join("\n");
}

function buildRecentTopLevelCommentsBlock(comments: RecentTopLevelComment[]): string {
  const lines = comments
    .slice(0, RECENT_TOP_LEVEL_COMMENT_LIMIT)
    .map((comment) =>
      buildCommentLine(comment.authorName, comment.body, COMMENT_EXCERPT_MAX_CHARS),
    );

  return [
    "[recent_top_level_comments]",
    lines.length > 0 ? lines.join("\n") : "No recent top-level comments are available.",
  ].join("\n");
}

function buildAncestorCommentsBlock(comments: CommentSource[]): string {
  const lines = comments.map((comment) =>
    buildCommentLine(comment.authorName, comment.body, COMMENT_EXCERPT_MAX_CHARS),
  );
  return [
    "[ancestor_comments]",
    lines.length > 0 ? lines.join("\n") : "No ancestor comments are available.",
  ].join("\n");
}

function buildSourceCommentBlock(comment: CommentSource): string {
  return [
    "[source_comment]",
    buildCommentLine(comment.authorName, comment.body, SOURCE_COMMENT_EXCERPT_MAX_CHARS),
  ].join("\n");
}

function resolveTaskPostId(task: AiAgentRecentTaskSnapshot): string | null {
  if (task.sourceTable === "posts" && task.sourceId) {
    return task.sourceId;
  }
  return typeof task.payload.postId === "string" ? task.payload.postId : null;
}

function resolveTaskCommentId(task: AiAgentRecentTaskSnapshot): string | null {
  if (task.sourceTable === "comments" && task.sourceId) {
    return task.sourceId;
  }
  return typeof task.payload.commentId === "string" ? task.payload.commentId : null;
}

export class AiAgentPersonaTaskContextBuilder {
  private readonly deps: AiAgentPersonaTaskContextBuilderDeps;

  public constructor(options?: { deps?: Partial<AiAgentPersonaTaskContextBuilderDeps> }) {
    this.deps = {
      loadPostSource: options?.deps?.loadPostSource ?? ((postId) => this.readPostSource(postId)),
      loadCommentSource:
        options?.deps?.loadCommentSource ?? ((commentId) => this.readCommentSource(commentId)),
      listRecentBoardPosts:
        options?.deps?.listRecentBoardPosts ?? ((boardId) => this.readRecentBoardPosts(boardId)),
      listRecentTopLevelComments:
        options?.deps?.listRecentTopLevelComments ??
        ((postId) => this.readRecentTopLevelComments(postId)),
    };
  }

  public async build(input: {
    task: AiAgentRecentTaskSnapshot;
  }): Promise<AiAgentPersonaTaskPromptContext> {
    const flowKind = resolveFlowKind(input.task);
    if (flowKind === "post") {
      return this.buildPostContext(input.task);
    }
    if (flowKind === "reply") {
      const sourceCommentId = resolveTaskCommentId(input.task);
      if (sourceCommentId) {
        return this.buildThreadReplyContext(sourceCommentId);
      }
    }
    return this.buildCommentContext(input.task);
  }

  private async buildPostContext(
    task: AiAgentRecentTaskSnapshot,
  ): Promise<AiAgentPersonaTaskPromptContext> {
    const sourcePostId = resolveTaskPostId(task);
    const sourcePost = sourcePostId ? await this.deps.loadPostSource(sourcePostId) : null;
    const board = sourcePost?.board ?? null;
    const recentBoardPosts = board ? await this.deps.listRecentBoardPosts(board.id) : [];

    return {
      flowKind: "post",
      taskType: "post",
      taskContext: [
        "Generate a new post for the board below.",
        "Treat this as a fresh post, not a reply.",
        "Do not produce a title or topic framing that feels too similar to the recent board post titles.",
        "Prefer a title that extends the board's active discussion into a meaningfully new angle.",
      ].join("\n"),
      boardContextText: buildBoardContextText(board),
      targetContextText: buildRecentBoardPostsBlock(recentBoardPosts),
    };
  }

  private async buildCommentContext(
    task: AiAgentRecentTaskSnapshot,
  ): Promise<AiAgentPersonaTaskPromptContext> {
    const sourceCommentId = resolveTaskCommentId(task);
    if (sourceCommentId) {
      return this.buildThreadReplyContext(sourceCommentId);
    }

    const sourcePostId = resolveTaskPostId(task);
    if (sourcePostId) {
      return this.buildTopLevelCommentContext(sourcePostId);
    }

    return {
      flowKind: "comment",
      taskType: "comment",
      taskContext: [
        "Generate a comment for the discussion below.",
        "This comment should stand on its own as a top-level contribution to the post.",
        "Add net-new value instead of paraphrasing the post or echoing recent comments.",
      ].join("\n"),
    };
  }

  private async buildTopLevelCommentContext(
    postId: string,
  ): Promise<AiAgentPersonaTaskPromptContext> {
    const post = await this.deps.loadPostSource(postId);
    const recentTopLevelComments = await this.deps.listRecentTopLevelComments(postId);

    return {
      flowKind: "comment",
      taskType: "comment",
      taskContext: [
        "Generate a comment for the discussion below.",
        "This comment should stand on its own as a top-level contribution to the post.",
        "Add net-new value instead of paraphrasing the post or echoing recent comments.",
      ].join("\n"),
      boardContextText: buildBoardContextText(post?.board ?? null),
      targetContextText: [
        post ? buildRootPostBlock(post) : null,
        buildRecentTopLevelCommentsBlock(recentTopLevelComments),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    };
  }

  private async buildThreadReplyContext(
    commentId: string,
  ): Promise<AiAgentPersonaTaskPromptContext> {
    const sourceComment = await this.deps.loadCommentSource(commentId);
    if (!sourceComment) {
      return {
        flowKind: "reply",
        taskType: "comment",
        taskContext: [
          "Generate a reply inside the active thread below.",
          "Respond to the thread directly instead of restarting the conversation from scratch.",
          "Move the exchange forward with a concrete, in-character reply.",
        ].join("\n"),
      };
    }

    const ancestorComments = await this.readAncestorComments(sourceComment);
    const ancestorIds = new Set(ancestorComments.map((comment) => comment.id));
    const rootPost = sourceComment.post ?? (await this.deps.loadPostSource(sourceComment.postId));
    const recentTopLevelComments = (
      await this.deps.listRecentTopLevelComments(sourceComment.postId)
    ).filter((comment) => !ancestorIds.has(comment.id));

    return {
      flowKind: "reply",
      taskType: "comment",
      taskContext: [
        "Generate a reply inside the active thread below.",
        "Respond to the thread directly instead of restarting the conversation from scratch.",
        "Move the exchange forward with a concrete, in-character reply.",
      ].join("\n"),
      boardContextText: buildBoardContextText(rootPost?.board ?? null),
      targetContextText: [
        rootPost ? buildRootPostBlock(rootPost) : null,
        buildSourceCommentBlock(sourceComment),
        buildAncestorCommentsBlock(ancestorComments),
        buildRecentTopLevelCommentsBlock(recentTopLevelComments),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    };
  }

  private async readAncestorComments(sourceComment: CommentSource): Promise<CommentSource[]> {
    const ancestors: CommentSource[] = [];
    let currentParentId = sourceComment.parentId;

    while (currentParentId && ancestors.length < ANCESTOR_COMMENT_LIMIT) {
      const current = await this.deps.loadCommentSource(currentParentId);
      if (!current) {
        break;
      }
      ancestors.push(current);
      currentParentId = current.parentId;
    }

    return ancestors.reverse();
  }

  private async readPostSource(postId: string): Promise<PostSource | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, body, boards(id, name, description, rules)")
      .eq("id", postId)
      .maybeSingle<RawPostRow>();

    if (error) {
      throw new Error(`load source post for prompt context failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      body: data.body,
      board: mapBoardSource(data.boards),
    };
  }

  private async readCommentSource(commentId: string): Promise<CommentSource | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, post_id, parent_id, body, persona_id, profiles(username, display_name), personas(username, display_name), posts(id, title, body, boards(id, name, description, rules))",
      )
      .eq("id", commentId)
      .maybeSingle<RawCommentRow>();

    if (error) {
      throw new Error(`load source comment for prompt context failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const personaIdentity = asSingle(data.personas);
    const profileIdentity = asSingle(data.profiles);
    const preferredIdentity = data.persona_id ? personaIdentity : profileIdentity;
    const authorName =
      preferredIdentity?.username?.trim() ||
      preferredIdentity?.display_name?.trim() ||
      personaIdentity?.username?.trim() ||
      profileIdentity?.username?.trim() ||
      "unknown";
    const post = asSingle(data.posts);

    return {
      id: data.id,
      body: data.body,
      parentId: data.parent_id,
      postId: data.post_id,
      authorName,
      post: post?.id
        ? {
            id: post.id,
            title: post.title ?? "",
            body: post.body ?? "",
            board: mapBoardSource(post.boards),
          }
        : null,
    };
  }

  private async readRecentBoardPosts(boardId: string): Promise<RecentBoardPost[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, title")
      .eq("board_id", boardId)
      .eq("status", "PUBLISHED")
      .order("created_at", { ascending: false })
      .limit(RECENT_BOARD_POST_LIMIT)
      .returns<Array<{ id: string; title: string }>>();

    if (error) {
      throw new Error(`load recent board posts for prompt context failed: ${error.message}`);
    }

    return (data ?? []).filter((row) => row.title.trim().length > 0);
  }

  private async readRecentTopLevelComments(postId: string): Promise<RecentTopLevelComment[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("comments")
      .select(
        "id, post_id, parent_id, body, persona_id, profiles(username, display_name), personas(username, display_name)",
      )
      .eq("post_id", postId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_TOP_LEVEL_COMMENT_FETCH_LIMIT)
      .returns<RawCommentRow[]>();

    if (error) {
      throw new Error(`load recent top-level comments for prompt context failed: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const personaIdentity = asSingle(row.personas);
      const profileIdentity = asSingle(row.profiles);
      const preferredIdentity = row.persona_id ? personaIdentity : profileIdentity;
      const authorName =
        preferredIdentity?.username?.trim() ||
        preferredIdentity?.display_name?.trim() ||
        personaIdentity?.username?.trim() ||
        profileIdentity?.username?.trim() ||
        "unknown";

      return {
        id: row.id,
        body: row.body,
        parentId: row.parent_id,
        postId: row.post_id,
        authorName,
      };
    });
  }
}
