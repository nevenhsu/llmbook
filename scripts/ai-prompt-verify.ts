import { createAdminClient } from "@/lib/supabase/admin";
import { rankFocusCandidates } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import { buildRuntimeSoulProfile } from "@/lib/ai/soul/runtime-soul-profile";
import { buildRuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { generateReplyTextWithPromptRuntime } from "@/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime";
import { getPromptRuntimeStatus } from "@/lib/ai/prompt-runtime/runtime-events";
import { CachedReplyPolicyProvider } from "@/lib/ai/policy/policy-control-plane";

type PostRow = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  persona_id: string | null;
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

function readArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function shortId(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.slice(0, 8);
}

function actorLabel(row: { author_id: string | null; persona_id: string | null }): string {
  if (row.author_id) return `user:${shortId(row.author_id)}`;
  if (row.persona_id) return `persona:${shortId(row.persona_id)}`;
  return "unknown";
}

async function main(): Promise<void> {
  const personaId = readArg("--personaId");
  const postId = readArg("--postId");
  if (!personaId || !postId) {
    throw new Error("--personaId and --postId are required");
  }

  const now = new Date();
  const supabase = createAdminClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, title, body, author_id, persona_id")
    .eq("id", postId)
    .single<PostRow>();

  if (postError || !post) {
    throw new Error(`post load failed: ${postError?.message ?? "not found"}`);
  }

  const { data: comments, error: commentError } = await supabase
    .from("comments")
    .select("id, post_id, parent_id, author_id, persona_id, body, created_at")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(40);

  if (commentError) {
    throw new Error(`comment load failed: ${commentError.message}`);
  }

  const ranked = rankFocusCandidates({
    comments: ((comments ?? []) as CommentRow[]).map((comment) => ({ ...comment })),
    personaId,
  });
  const focus = ranked.find((row) => row.persona_id !== personaId);
  const focusActor = focus ? actorLabel(focus) : actorLabel(post);
  const focusSnippet = focus ? normalizeText(focus.body).slice(0, 120) : null;

  const participants = new Set<string>();
  participants.add(actorLabel(post));
  for (const row of (comments ?? []) as CommentRow[]) {
    participants.add(actorLabel(row));
  }

  const soul = await buildRuntimeSoulProfile({ personaId, now, tolerateFailure: true });
  const memoryContext = await buildRuntimeMemoryContext({
    personaId,
    threadId: postId,
    taskType: "reply",
    now,
    tolerateFailure: true,
  });

  const runtime = await generateReplyTextWithPromptRuntime({
    entityId: `verify:${personaId}:${postId}`,
    personaId,
    postId,
    title: normalizeText(post.title || "this post"),
    postBodySnippet: normalizeText(post.body || "").slice(0, 180),
    focusActor,
    focusSnippet,
    participantCount: participants.size,
    soul,
    memoryContext,
    policy: await new CachedReplyPolicyProvider().getReplyPolicy({ personaId }),
    now,
  });

  const status = getPromptRuntimeStatus();

  console.log(
    JSON.stringify(
      {
        promptBlocks: runtime.promptBlocks.map((block) => ({
          name: block.name,
          enabled: block.enabled,
          degraded: block.degraded,
          degradeReason: block.degradeReason ?? null,
        })),
        model: {
          provider: runtime.model.provider,
          model: runtime.model.model,
          fallbackUsed: runtime.usedFallback,
          fallbackReason: runtime.fallbackReason,
          finishReason: runtime.model.finishReason,
        },
        recentFailures: {
          prompt: status.lastPromptFailure,
          model: status.lastModelFailure,
          fallback: status.lastFallback,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
