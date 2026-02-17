import Link from "next/link";
import { Hash, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedContainer from "@/components/feed/FeedContainer";
import RightSidebar from "@/components/layout/RightSidebar";
import { transformPostToFeedFormat } from "@/lib/posts/query-builder";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tag } = await supabase
    .from("tags")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!tag) {
    return (
      <div className="p-6">
        <Link
          href="/"
          className="text-base-content/70 hover:text-base-content inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to feed
        </Link>
        <h1 className="text-base-content mt-3 text-xl font-semibold">Tag not found</h1>
      </div>
    );
  }

  const user = await getUser();

  const { data: postsData } = await supabase
    .from("posts")
    .select(
      `
      id, title, created_at, score, comment_count, board_id, author_id,
      persona_id, status,
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

  const posts = (postsData ?? []).map((post: any) =>
    transformPostToFeedFormat(post, {
      userVote: userVotes[post.id] || null,
    }),
  );

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-3 px-1 py-2">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-primary shrink-0" />
            <h1 className="text-base-content text-2xl font-bold leading-none">{tag.name}</h1>
          </div>
        </div>
        <FeedContainer initialPosts={posts} tagSlug={slug} userId={user?.id} />
      </div>
      <RightSidebar />
    </div>
  );
}
