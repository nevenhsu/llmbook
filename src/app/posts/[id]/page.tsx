import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ChevronDown } from "lucide-react";
import PostRow from "@/components/post/PostRow";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const { data: post } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,
       boards(id,name,slug,description),
       profiles(display_name),
       media(id,url),
       post_tags(tag:tags(name))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!post) {
    return (
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-xl font-semibold">Post not found</h1>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to feed
        </Link>
      </div>
    );
  }

  const board = post.boards as any;
  const profileName = (post.profiles as any)?.display_name ?? "Anonymous";

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-4">
      <div className="flex-1 min-w-0">
        <article className="bg-base-100 sm:rounded-box border-0 sm:border border-neutral overflow-hidden">
          {/* Post Content */}
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-[#818384] mb-2">
              <div className="h-5 w-5 rounded-full bg-gray-600"></div>
              {board && (
                <Link
                  href={`/boards/${board.slug}`}
                  className="font-bold text-base-content hover:underline"
                >
                  r/{board.name}
                </Link>
              )}
              <span>•</span>
              <span>Posted by u/{profileName}</span>
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-base-content mb-4 break-words [overflow-wrap:anywhere]">
              {post.title}
            </h1>

            <div className="text-sm text-base-content whitespace-pre-wrap break-words [overflow-wrap:anywhere] mb-4">
              {post.body}
            </div>

            {post.media?.map((media: any) => (
              <div key={media.id} className="mt-4 first:mt-0 rounded-lg overflow-hidden border border-neutral bg-black">
                <img
                  src={media.url}
                  alt={post.title}
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            ))}
          </div>
        </article>

        {/* Mobile Board Info (Task M4.1) */}
        {board && (
          <div className="lg:hidden collapse collapse-arrow bg-base-100 border border-neutral rounded-box my-4">
            <input type="checkbox" />
            <div className="collapse-title flex items-center justify-between">
              <Link
                href={`/boards/${board.slug}`}
                className="font-bold text-sm text-base-content"
              >
                r/{board.name}
              </Link>
              <span className="text-xs text-[#818384]">1.2k members</span>
            </div>
            <div className="collapse-content text-sm text-[#818384]">
              {board.description || "Welcome to our community!"}
            </div>
          </div>
        )}

        {/* Comments Section Placeholder */}
        <div className="mt-4 bg-base-100 sm:rounded-box border-0 sm:border border-neutral p-4">
          <h3 className="text-sm font-bold text-base-content mb-4 uppercase tracking-wider">
            Comments
          </h3>
          <p className="text-sm text-[#818384]">Comments are coming soon...</p>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[312px] space-y-4">
        {board && (
          <div className="bg-base-100 rounded-box border border-neutral p-4">
            <h3 className="font-bold text-base-content mb-2">About r/{board.name}</h3>
            <p className="text-sm text-[#818384] mb-4">{board.description}</p>
            <div className="flex items-center justify-between text-xs text-base-content border-t border-neutral pt-4">
              <div className="flex flex-col">
                <span className="font-bold">1.2k</span>
                <span className="text-[#818384]">Members</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold">42</span>
                <span className="text-[#818384]">Online</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
