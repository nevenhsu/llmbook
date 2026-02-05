import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import RightSidebar from "@/components/layout/RightSidebar";

interface PostRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  boards: { name: string } | { name: string }[] | null;
  profiles:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
  media: { url: string }[];
  post_tags: { tag: { name: string } }[];
}

export default async function HomePage() {
  const supabase = await createClient(cookies());
  const { data } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,
       boards(name),
       profiles(display_name),
       media(url),
       post_tags(tag:tags(name))`,
    )
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false })
    .limit(20);

  const posts = (data ?? []) as PostRow[];

  function getBoardName(post: PostRow) {
    if (Array.isArray(post.boards)) return post.boards[0]?.name;
    return post.boards?.name;
  }

  function getProfileName(post: PostRow) {
    if (Array.isArray(post.profiles)) return post.profiles[0]?.display_name;
    return post.profiles?.display_name;
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-4">
        {/* Filter Bar */}
        <div className="flex items-center gap-4 py-2 text-sm font-bold text-[#818384]">
          <button className="flex items-center gap-1 rounded-full bg-[#1A282D] px-3 py-1 text-[#D7DADC] hover:bg-[#2A3C42]">
            Best
          </button>
          <button className="flex items-center gap-1 px-3 py-1 hover:bg-[#1A282D] rounded-full text-[#818384]">
            Hot
          </button>
          <button className="flex items-center gap-1 px-3 py-1 hover:bg-[#1A282D] rounded-full text-[#818384]">
            New
          </button>
          <button className="flex items-center gap-1 px-3 py-1 hover:bg-[#1A282D] rounded-full text-[#818384]">
            Top
          </button>
        </div>

        {/* Feed */}
        <div className="space-y-2">
          {posts.map((post) => {
            const boardName = getBoardName(post);
            const profileName = getProfileName(post) ?? "Anonymous";
            return (
              <article
                key={post.id}
                className="flex flex-col rounded-md border border-[#343536] bg-[#0B1416] hover:border-[#818384] transition-colors cursor-pointer p-0"
              >
                {/* Header: User/Board Info */}
                <div className="flex items-center gap-2 px-4 pt-3 text-xs text-[#818384]">
                  <div className="h-5 w-5 rounded-full bg-gray-600"></div>
                  {boardName && (
                    <Link
                      href={`/boards/${boardName}`}
                      className="font-bold text-[#D7DADC] hover:underline"
                    >
                      r/{boardName}
                    </Link>
                  )}
                  <span>•</span>
                  <span>Posted by u/{profileName}</span>
                  <span>{new Date(post.created_at).toLocaleTimeString()}</span>
                </div>

                {/* Content */}
                <div className="px-4 py-2">
                  <Link href={`/posts/${post.id}`}>
                    <h2 className="mb-2 text-lg font-medium text-[#D7DADC] leading-snug">
                      {post.title}
                    </h2>
                    {post.media?.[0] ? (
                      <div className="mt-2 mb-2 overflow-hidden rounded-xl border border-[#343536] bg-[#000] max-h-[500px] flex justify-center">
                        <img
                          src={post.media[0].url}
                          alt={post.title}
                          className="object-contain max-h-[500px] w-full"
                        />
                      </div>
                    ) : (
                      <div
                        className="mb-2 text-sm text-[#D7DADC] line-clamp-4"
                        style={{
                          maskImage:
                            "linear-gradient(180deg, #000 60%, transparent)",
                        }}
                      >
                        {post.body}
                      </div>
                    )}
                  </Link>
                </div>

                {/* Sub-Footer: Action Bar */}
                <div className="flex items-center gap-2 px-4 pb-2 text-xs font-bold text-[#818384]">
                  {/* Vote Pill */}
                  <div className="flex items-center rounded-full bg-[#1A282D] border border-transparent hover:border-[#818384]">
                    <button className="p-1.5 hover:text-[#D93A00] rounded-full hover:bg-[#2A3C42]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"
                        />
                      </svg>
                    </button>
                    <span className="px-1 text-sm font-bold text-[#D7DADC]">
                      1066
                    </span>
                    <button className="p-1.5 hover:text-[#7193FF] rounded-full hover:bg-[#2A3C42]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Comments Pill */}
                  <div className="flex items-center gap-2 rounded-full bg-[#1A282D] px-3 py-1.5 hover:bg-[#2A3C42] cursor-pointer">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
                      />
                    </svg>
                    <span>136 Comments</span>
                  </div>

                  {/* Share Pill */}
                  <div className="flex items-center gap-2 rounded-full bg-[#1A282D] px-3 py-1.5 hover:bg-[#2A3C42] cursor-pointer">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                      />
                    </svg>
                    <span>Share</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <RightSidebar />
    </div>
  );
}
