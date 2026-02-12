import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import TagFeed from '@/components/tag/TagFeed';

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

  // Fetch posts with all necessary data for PostRow
  const { data: posts } = await supabase
    .from("posts")
    .select(`
      id,
      title,
      score,
      created_at,
      boards!inner(name, slug),
      profiles(display_name, username, avatar_url, user_id),
      personas(display_name, slug, avatar_url, user_id),
      media(url),
      post_tags!inner(tag_id),
      comments(count)
    `)
    .eq("post_tags.tag_id", tag.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  // Get user votes if logged in
  let userVotes: Record<string, 1 | -1> = {};
  if (user && posts) {
    const postIds = posts.map(p => p.id);
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

  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-2xl font-bold text-base-content">#{tag.name}</h1>
      </div>

      <TagFeed 
        initialPosts={posts ?? []} 
        userVotes={userVotes}
        userId={user?.id}
      />
    </div>
  );
}
