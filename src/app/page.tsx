import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import FeedSortBar from '@/components/feed/FeedSortBar';
import FeedContainer from '@/components/feed/FeedContainer';
import RightSidebar from '@/components/layout/RightSidebar';
import { hotScore, getTimeRangeDate } from '@/lib/ranking';

interface PageProps {
  searchParams?: Promise<{ sort?: string; t?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const sort = params.sort ?? 'new';
  const t = params.t ?? 'today';
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch posts
  let query = supabase
    .from('posts')
    .select(`
      id, title, body, created_at, score, comment_count, persona_id,
      boards!inner(name, slug),
      profiles(display_name, avatar_url),
      personas(display_name, avatar_url, slug),
      media(url),
      post_tags(tag:tags(name))
    `)
    .eq('status', 'PUBLISHED');

  if (user) {
    const { data: hidden } = await supabase.from('hidden_posts').select('post_id').eq('user_id', user.id);
    if (hidden && hidden.length > 0) {
      query = query.not('id', 'in', `(${hidden.map(h => h.post_id).join(',')})`);
    }
  }

  if (sort === 'top') {
    const since = getTimeRangeDate(t);
    if (since) query = query.gte('created_at', since);
    query = query.order('score', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data } = await query.limit(50) as { data: any[] | null };

  let posts = (data ?? []).map(post => {
    const isPersona = !!post.persona_id;
    const author = isPersona ? post.personas : post.profiles;
    const authorData = Array.isArray(author) ? author[0] : author;
    
    return {
      id: post.id,
      title: post.title,
      score: post.score ?? 0,
      commentCount: post.comment_count ?? 0,
      boardName: Array.isArray(post.boards) ? post.boards[0]?.name ?? '' : post.boards?.name ?? '',
      boardSlug: Array.isArray(post.boards) ? post.boards[0]?.slug ?? '' : post.boards?.slug ?? '',
      authorName: authorData?.display_name ?? 'Anonymous',
      authorAvatarUrl: authorData?.avatar_url ?? null,
      isPersona,
      createdAt: post.created_at,
      thumbnailUrl: post.media?.[0]?.url ?? null,
      flairs: post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
      userVote: null as (1 | -1 | null),
    };
  });

  if (sort === 'hot' || sort === 'best') {
    posts = posts.sort((a, b) => hotScore(b.score, b.createdAt) - hotScore(a.score, a.createdAt));
  }

  let userVotes: any[] = [];
  if (user && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const { data: votes } = await supabase
      .from('votes')
      .select('post_id, value')
      .in('post_id', postIds)
      .eq('user_id', user.id);
    userVotes = votes ?? [];
  }

  const voteMap = Object.fromEntries(userVotes.map(v => [v.post_id, v.value]));
  
  const finalPosts = posts.map(post => ({
    ...post,
    userVote: voteMap[post.id] ?? null
  }));

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <FeedSortBar />
        <FeedContainer initialPosts={finalPosts} userId={user?.id} />
      </div>
      <RightSidebar />
    </div>
  );
}
