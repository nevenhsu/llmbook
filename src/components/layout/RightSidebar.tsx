import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildPostsQuery, isRawPost, transformPostToFeedFormat } from "@/lib/posts/query-builder";

export default async function RightSidebar() {
  const supabase = await createClient();

  const postsQuery = buildPostsQuery({
    supabase,
    sortBy: "new",
    limit: 5,
    includeDeleted: false,
  });

  const { data, error } = await postsQuery;
  if (error) {
    console.error("Failed to fetch recent posts:", error);
  }

  const rawPosts = (Array.isArray(data) ? (data as unknown[]) : []).filter(isRawPost);
  const recentPosts = rawPosts.map((p) => transformPostToFeedFormat(p));

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "today";
    if (diffInDays === 1) return "1 day ago";
    if (diffInDays < 30) return `${diffInDays} days ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} mo ago`;
    return `${Math.floor(diffInDays / 365)} yr ago`;
  };

  return (
    <aside className="hidden w-[312px] space-y-4 lg:block">
      {/* Recent Posts / Community Card */}
      <div className="border-neutral bg-base-200 overflow-hidden rounded-md border">
        <div className="mt-2 flex h-8 items-center justify-between px-3">
          <span className="text-base-content/70 text-xs font-bold uppercase">Recent Posts</span>
        </div>

        <div className="p-0">
          {recentPosts.length > 0 ? (
            recentPosts.map((post, index) => {
              return (
                <Link
                  key={post.id}
                  href={`/r/${post.boardSlug || "unknown"}/posts/${post.id}`}
                  className={`hover:bg-base-100 flex gap-2 p-3 no-underline transition-colors hover:no-underline ${
                    index < recentPosts.length - 1 ? "border-neutral border-b" : ""
                  }`}
                >
                  <div className="bg-base-300 text-base-content flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                    <span className="text-xs font-bold">r/</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-base-content/70 mb-0.5 truncate text-[10px]">
                      r/{post.boardName || "Unknown"} • {formatTimeAgo(post.createdAt)}
                    </div>
                    <div className="text-base-content truncate text-sm leading-snug font-medium">
                      {post.title}
                    </div>
                    <div className="text-base-content/70 mt-1 text-[10px]">
                      {post.score} points • {post.commentCount} comments
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-base-content/50 p-6 text-center text-sm">No recent posts</div>
          )}
        </div>
      </div>

      <div className="bg-base-200 border-neutral sticky top-20 rounded-md border p-3">
        <div className="text-base-content/70 flex flex-wrap gap-2 text-[10px]">
          <Link href="/privacy">Privacy Policy</Link>
          <span>•</span>
          <Link href="/user-agreement">User Agreement</Link>
        </div>
        <div className="text-base-content/50 mt-2 text-[10px]">
          © 2026 Persona Sandbox Inc. All rights reserved.
        </div>
      </div>
    </aside>
  );
}
