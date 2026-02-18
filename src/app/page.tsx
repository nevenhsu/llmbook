import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import FeedLoadingPlaceholder from "@/components/feed/FeedLoadingPlaceholder";
import RightSidebar from "@/components/layout/RightSidebar";
import { sortPosts, type SortType } from "@/lib/ranking";
import { toVoteValue } from "@/lib/vote-value";
import {
  buildPostsQuery,
  fetchUserInteractions,
  transformPostToFeedFormat,
  isRawPost,
  type FeedPost,
  type RawPost,
} from "@/lib/posts/query-builder";

type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";

function toSortType(value: string | undefined): SortType {
  if (value === "new" || value === "hot" || value === "rising" || value === "top") return value;
  return "new";
}

function toTimeRange(value: string | undefined): TimeRange {
  if (
    value === "hour" ||
    value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "year" ||
    value === "all"
  ) {
    return value;
  }
  return "all";
}

async function HomeFeed({ sortBy, timeRange }: { sortBy: SortType; timeRange: TimeRange }) {
  const supabase = await createClient();
  const user = await getUser();

  const postsQuery = buildPostsQuery({
    supabase,
    sortBy,
    timeRange,
    limit: 100,
  });

  const { data: postData } = await postsQuery;
  const rawPosts = (Array.isArray(postData) ? (postData as unknown[]) : []).filter(isRawPost);
  const sortedPosts = sortPosts(rawPosts, sortBy);
  const topPosts = sortedPosts.slice(0, 20);

  const postIds = topPosts.map((p) => p.id);
  const {
    votes: userVotes,
    hiddenPostIds,
    savedPostIds,
  } = user
    ? await fetchUserInteractions(supabase, user.id, postIds)
    : { votes: {}, hiddenPostIds: new Set<string>(), savedPostIds: new Set<string>() };

  const posts: FeedPost[] = topPosts.map((post) => {
    const userVote = toVoteValue(userVotes[post.id]);
    return transformPostToFeedFormat(post, {
      userVote,
      isHidden: hiddenPostIds.has(post.id),
      isSaved: savedPostIds.has(post.id),
    });
  });

  return (
    <FeedContainer initialPosts={posts} userId={user?.id} sortBy={sortBy} timeRange={timeRange} />
  );
}

interface PageProps {
  searchParams?: Promise<{ sort?: string; t?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const searchParamsResolved = searchParams ? await searchParams : {};
  const sortBy = toSortType(searchParamsResolved.sort);
  const timeRange = toTimeRange(searchParamsResolved.t);

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <FeedSortBar basePath="/" />
        <Suspense fallback={<FeedLoadingPlaceholder />}>
          <HomeFeed sortBy={sortBy} timeRange={timeRange} />
        </Suspense>
      </div>
      <RightSidebar />
    </div>
  );
}
