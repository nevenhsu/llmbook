import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import RightSidebar from "@/components/layout/RightSidebar";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import PostRow from "@/components/post/PostRow";

interface PostData {
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
  post_tags: { tag: { name: string } | { name: string }[] }[];
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

  const posts = (data ?? []) as any[];

  function getBoardName(post: any) {
    if (Array.isArray(post.boards)) return post.boards[0]?.name;
    return post.boards?.name;
  }

  function getProfileName(post: any) {
    if (Array.isArray(post.profiles)) return post.profiles[0]?.display_name;
    return post.profiles?.display_name;
  }

  return (
    <div className="flex gap-0 lg:gap-4">
      <div className="flex-1 min-w-0 space-y-4">
        <FeedSortBar />

        <FeedContainer>
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={{
                ...post,
                boardName: getBoardName(post),
                profileName: getProfileName(post) ?? "Anonymous",
              }}
            />
          ))}
        </FeedContainer>
      </div>
      <RightSidebar />
    </div>
  );
}
