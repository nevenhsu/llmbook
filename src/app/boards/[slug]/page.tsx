import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import PostRow from "@/components/post/PostRow";

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
      <div className="bg-base-100 p-6 rounded-box border border-neutral">
        <h1 className="text-xl font-semibold">Board not found</h1>
        <Link href="/" className="btn btn-ghost mt-4">
          Back to feed
        </Link>
      </div>
    );
  }

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,
       profiles(display_name),
       media(id,url)`,
    )
    .eq("board_id", board.id)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-4">
      <div className="flex-1 min-w-0">
        {/* Board Header Banner (Task M5.5) */}
        <div className="w-full h-[120px] sm:h-[200px] bg-base-300 rounded-none sm:rounded-t-box overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-base-100 bg-primary flex items-center justify-center text-white text-2xl font-bold">
                r/
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl font-bold text-white">r/{board.name}</h1>
                <p className="text-white/80 text-sm">r/{board.slug}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Board Info Mobile (Task M5.5) */}
        <div className="lg:hidden px-4 py-3 border-b border-neutral bg-base-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-base-content">
                r/{board.name}
              </h1>
              <p className="text-xs text-[#818384]">1.2k members</p>
            </div>
            <button className="btn btn-primary btn-sm rounded-full px-6">
              Join
            </button>
          </div>
          {board.description && (
            <p className="mt-2 text-sm text-[#818384] line-clamp-2">
              {board.description}
            </p>
          )}
        </div>

        <div className="py-4">
          <FeedSortBar />
        </div>

        <FeedContainer>
          {(posts ?? []).map((post) => (
            <PostRow
              key={post.id}
              post={{
                ...post,
                boardName: board.name,
                profileName: (post.profiles as any)?.display_name ?? "Anonymous",
              }}
            />
          ))}
        </FeedContainer>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[312px] space-y-4 pt-[120px]">
        <div className="bg-base-100 rounded-box border border-neutral p-4">
          <h3 className="font-bold text-base-content mb-2">
            About r/{board.name}
          </h3>
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
          <button className="btn btn-primary w-full rounded-full mt-4">
            Join Community
          </button>
        </div>
      </aside>
    </div>
  );
}
