import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import FeedLoadingPlaceholder from "@/components/feed/FeedLoadingPlaceholder";
import RightSidebar from "@/components/layout/RightSidebar";
import {
  sortPosts,
  getHotPostsFromCache,
  getRisingPostsFromCache,
  type SortType,
} from "@/lib/ranking";
import { toVoteValue } from "@/lib/vote-value";
import { toSortType, toTimeRange, type TimeRange } from "@/lib/routing/sort-params";
import {
  buildPostsQuery,
  fetchUserInteractions,
  transformPostToFeedFormat,
  isRawPost,
  type FeedPost,
  type RawPost,
} from "@/lib/posts/query-builder";

async function HomeFeed({ sortBy, timeRange }: { sortBy: SortType; timeRange: TimeRange }) {
  const supabase = await createClient();
  const user = await getUser();

  let topPosts: RawPost[];

  if (sortBy === "hot") {
    const { posts: cachedPosts } = await getHotPostsFromCache(supabase, { limit: 20 });
    topPosts = (Array.isArray(cachedPosts) ? (cachedPosts as unknown[]) : []).filter(isRawPost);
  } else if (sortBy === "rising") {
    const { posts: cachedPosts } = await getRisingPostsFromCache(supabase, { limit: 20 });
    topPosts = (Array.isArray(cachedPosts) ? (cachedPosts as unknown[]) : []).filter(isRawPost);
  } else {
    const postsQuery = buildPostsQuery({
      supabase,
      sortBy,
      timeRange,
      limit: 20,
    });
    const { data: postData } = await postsQuery;
    const rawPosts = (Array.isArray(postData) ? (postData as unknown[]) : []).filter(isRawPost);
    topPosts = sortPosts(rawPosts, sortBy).slice(0, 20);
  }

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
