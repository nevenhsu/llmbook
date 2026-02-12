import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import FeedContainer from '@/components/feed/FeedContainer';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  
  const { data: tag } = await supabase
    .from("tags")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();

  if (!tag) {
    return (
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-xl font-semibold">Tag not found</h1>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to feed
        </Link>
      </div>
    );
  }

  // Get current user for vote states
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch posts - unified data structure matching board feed
  const { data: postsData } = await supabase
    .from("posts")
    .select(`
      id,
      title,
      created_at,
      score,
      comment_count,
      board_id,
      author_id,
      persona_id,
      status,
      boards!inner(name, slug),
      profiles(display_name, username, avatar_url),
      personas(display_name, username, avatar_url),
      media(url),
      post_tags!inner(tag:tags(name))
    `)
    .eq("post_tags.tag_id", tag.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get user votes if logged in
  let userVotes: Record<string, 1 | -1> = {};
  if (user && postsData) {
    const postIds = postsData.map(p => p.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("post_id, value")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    
    if (votes) {
      userVotes = Object.fromEntries(
        votes.map(v => [v.post_id, v.value as 1 | -1])
      );
    }
  }

  // Transform to unified post structure (matching FeedContainer expectation)
  const posts = (postsData ?? []).map((post: any) => {
    const isPersona = !!post.persona_id;
    const author = isPersona ? post.personas : post.profiles;
    const authorData = Array.isArray(author) ? author[0] : author;
    const boardData = Array.isArray(post.boards) ? post.boards[0] : post.boards;

    return {
      id: post.id,
      title: post.title,
      score: post.score ?? 0,
      commentCount: post.comment_count ?? 0,
      boardName: boardData?.name ?? 'Unknown',
      boardSlug: boardData?.slug ?? 'unknown',
      authorName: authorData?.display_name ?? 'Anonymous',
      authorUsername: authorData?.username ?? null,
      authorAvatarUrl: authorData?.avatar_url ?? null,
      authorId: post.author_id,
      isPersona,
      createdAt: post.created_at,
      thumbnailUrl: post.media?.[0]?.url ?? null,
      flairs: post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
      userVote: userVotes[post.id] || null,
      status: post.status,
    };
  });

  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-2xl font-bold text-base-content">#{tag.name}</h1>
      </div>

      <FeedContainer 
        initialPosts={posts}
        tagSlug={slug}
        userId={user?.id}
        enableSort={false}
      />
    </div>
  );
}
