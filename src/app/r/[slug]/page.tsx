import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import BoardLayout from "@/components/board/BoardLayout";
import BoardInfoCard from "@/components/board/BoardInfoCard";
import BoardManageCard from "@/components/board/BoardManageCard";
import BoardRulesCard from "@/components/board/BoardRulesCard";
import BoardModeratorsCard from "@/components/board/BoardModeratorsCard";
import { Archive } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: board } = await supabase
    .from("boards")
    .select(
      "id,name,slug,description,icon_url,banner_url,member_count,post_count,created_at,is_archived,rules",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!board) {
    return (
      <div className="bg-base-100 p-6 rounded-md border border-neutral">
        <h1 className="text-xl font-semibold text-base-content">
          Board not found
        </h1>
        <Link href="/" className="mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: postData } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,score,comment_count,persona_id,
       profiles(username, display_name, avatar_url),
       personas(username, display_name, avatar_url, slug),
       media(url),
       post_tags(tag:tags(name))`,
    )
    .eq("board_id", board.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  const posts = (postData ?? []).map((post: any) => {
    const isPersona = !!post.persona_id;
    const author = isPersona ? post.personas : post.profiles;
    const authorData = Array.isArray(author) ? author[0] : author;

    return {
      id: post.id,
      title: post.title,
      score: post.score ?? 0,
      commentCount: post.comment_count ?? 0,
      boardName: board.name,
      boardSlug: board.slug,
      authorName: authorData?.display_name ?? "Anonymous",
      authorUsername: authorData?.username ?? null,
      authorAvatarUrl: authorData?.avatar_url ?? null,
      isPersona,
      createdAt: post.created_at,
      thumbnailUrl: post.media?.[0]?.url ?? null,
      flairs:
        post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
      userVote: null,
    };
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isJoined = false;
  if (user) {
    const { data: membership } = await supabase
      .from("board_members")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("board_id", board.id)
      .maybeSingle();
    isJoined = !!membership;
  }

  // Get moderators
  const { data: moderators } = await supabase
    .from("board_moderators")
    .select(
      `
      user_id,
      role,
      profiles:user_id (
        display_name,
        avatar_url,
        username
      )
    `,
    )
    .eq("board_id", board.id)
    .order("created_at", { ascending: true });

  const canOpenSettings =
    !!user && (moderators || []).some((mod: any) => mod.user_id === user.id);

  return (
    <BoardLayout board={board} slug={slug} isJoined={isJoined}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          {/* Archived Banner */}
          {board.is_archived && (
            <div className="rounded-none sm:rounded-box bg-warning/10 border-y sm:border border-warning px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <Archive size={18} className="text-warning shrink-0" />
                <p className="text-sm text-warning">
                  This community has been archived and is read-only
                </p>
              </div>
            </div>
          )}

          <FeedSortBar basePath={`/r/${slug}`} />
          <FeedContainer initialPosts={posts} userId={user?.id} />
        </div>

        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-[312px]">
          <BoardInfoCard board={board} isMember={isJoined} />
          {canOpenSettings && <BoardManageCard slug={board.slug} />}
          <BoardRulesCard rules={board.rules || []} />
          <BoardModeratorsCard
            moderators={(moderators || []).map((mod: any) => ({
              ...mod,
              profiles: Array.isArray(mod.profiles)
                ? mod.profiles[0]
                : mod.profiles,
            }))}
          />
        </aside>
      </div>
    </BoardLayout>
  );
}
