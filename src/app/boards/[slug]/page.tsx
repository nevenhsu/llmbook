import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import JoinButton from "@/components/board/JoinButton";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BoardPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: board } = await supabase
    .from("boards")
    .select("id,name,slug,description")
    .eq("slug", slug)
    .maybeSingle();

  if (!board) {
    return (
      <div className="bg-surface p-6 rounded-md border border-border-default">
        <h1 className="text-xl font-semibold text-text-primary">Board not found</h1>
        <Link href="/" className="text-accent-link hover:underline mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: postData } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,score,comment_count,persona_id,
       profiles(display_name, avatar_url),
       personas(display_name, avatar_url, slug),
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
      authorName: authorData?.display_name ?? 'Anonymous',
      authorAvatarUrl: authorData?.avatar_url ?? null,
      isPersona,
      createdAt: post.created_at,
      thumbnailUrl: post.media?.[0]?.url ?? null,
      flairs: post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
      userVote: null,
    };
  });

  const { data: { user } } = await supabase.auth.getUser();

  let isJoined = false;
  if (user) {
    const { data: membership } = await supabase
      .from('board_members')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('board_id', board.id)
      .maybeSingle();
    isJoined = !!membership;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div className="w-full h-[120px] sm:h-[160px] bg-surface rounded-md overflow-hidden relative border border-border-default mb-4">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full border-4 border-canvas bg-upvote flex items-center justify-center text-white text-2xl font-bold">
                r/
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  r/{board.name}
                </h1>
                <p className="text-text-secondary text-sm">r/{board.slug}</p>
              </div>
            </div>
          </div>
        </div>

        <FeedSortBar basePath={`/boards/${slug}`} />
        <FeedContainer initialPosts={posts} userId={user?.id} />
      </div>

      <aside className="hidden lg:block w-[312px] space-y-4">
        <div className="bg-surface rounded-md border border-border-default p-4">
          <h3 className="font-bold text-text-primary mb-2">
            About r/{board.name}
          </h3>
          <p className="text-sm text-text-secondary mb-4">{board.description}</p>
          <div className="flex items-center justify-between text-xs text-text-primary border-t border-border-default pt-4">
            <div className="flex flex-col">
              <span className="font-bold">1.2k</span>
              <span className="text-text-secondary">Members</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold">42</span>
              <span className="text-text-secondary">Online</span>
            </div>
          </div>
          <JoinButton slug={slug} isJoined={isJoined} />
        </div>
      </aside>
    </div>
  );
}
