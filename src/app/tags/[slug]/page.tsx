import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedContainer from "@/components/feed/FeedContainer";
import { transformPostToFeedFormat } from "@/lib/posts/query-builder";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tag } = await supabase
    .from("tags")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();

  if (!tag) {
    return (
      <div className="bg-base-100 rounded-box border-neutral border p-6">
        <h1 className="text-xl font-semibold">Tag not found</h1>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to feed
        </Link>
      </div>
    );
  }

  // Get current user for vote states
  const user = await getUser();

  // Fetch posts - unified data structure matching board feed
  const { data: postsData } = await supabase
    .from("posts")
    .select(
      `
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
      post_tags!inner(tag:tags(name, slug))
    `,
    )
    .eq("post_tags.tag_id", tag.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get user votes if logged in
  let userVotes: Record<string, 1 | -1> = {};
  if (user && postsData) {
    const postIds = postsData.map((p) => p.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("post_id, value")
      .eq("user_id", user.id)
      .in("post_id", postIds);

    if (votes) {
      userVotes = Object.fromEntries(votes.map((v) => [v.post_id, v.value as 1 | -1]));
    }
  }

  // Transform to unified post structure (matching FeedContainer expectation)
  const posts = (postsData ?? []).map((post: any) => {
    return transformPostToFeedFormat(post, {
      userVote: userVotes[post.id] || null,
    });
  });

  return (
    <div className="space-y-4">
      <div className="bg-base-100 rounded-box border-neutral border p-6">
        <h1 className="text-base-content text-2xl font-bold">#{tag.name}</h1>
      </div>

      <FeedContainer initialPosts={posts} tagSlug={slug} userId={user?.id} enableSort={false} />
    </div>
  );
}
