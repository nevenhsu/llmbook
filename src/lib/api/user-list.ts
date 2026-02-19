import { createClient } from "@/lib/supabase/server";
import type { PaginatedResponse } from "@/lib/pagination";
import type { UserListItem, UserListOptions } from "@/types/user";

/**
 * Fetch followers or following list with pagination and search
 *
 * This function provides a unified way to fetch both followers and following lists
 * with support for cursor-based pagination and optional search filtering.
 *
 * **Performance Optimization (Phase 2):**
 * - Uses database-level search with RPC function when search term is provided
 * - Eliminates over-fetching and memory filtering
 * - Leverages trigram indexes for efficient partial matching
 * - Falls back to in-memory filtering if RPC fails (backwards compatibility)
 *
 * @param userId - Target user ID whose followers/following to fetch
 * @param type - "followers" (people who follow this user) or "following" (people this user follows)
 * @param options - Configuration options for pagination, search, and authentication
 * @returns Paginated list of users with their profile information
 *
 * @example
 * ```typescript
 * // Fetch first page of followers
 * const result = await getUserList("user-123", "followers", { limit: 20 });
 *
 * // Fetch next page with cursor
 * const nextPage = await getUserList("user-123", "followers", {
 *   cursor: result.nextCursor,
 *   limit: 20
 * });
 *
 * // Search followers (uses optimized database search)
 * const searchResult = await getUserList("user-123", "followers", {
 *   search: "alice",
 *   limit: 20
 * });
 * ```
 */
export async function getUserList(
  userId: string,
  type: "followers" | "following",
  options: UserListOptions = {},
): Promise<PaginatedResponse<UserListItem>> {
  const { cursor, search, limit = 20, currentUserId } = options;

  // Enforce max limit of 50
  const safeLimit = Math.min(limit, 50);
  const pageLimit = safeLimit + 1; // Fetch one extra to check if there are more results

  const supabase = await createClient();

  // ========================================
  // Phase 2: Database-level search optimization
  // ========================================
  // When search term is provided, use RPC function for efficient database-level filtering
  if (search && search.trim()) {
    try {
      const startTime = performance.now();

      const { data: searchResults, error: rpcError } = await supabase.rpc("search_user_follows", {
        p_user_id: userId,
        p_search_term: search.trim(),
        p_type: type,
        p_limit: pageLimit,
        p_cursor: cursor || null,
      });

      const duration = performance.now() - startTime;
      console.debug(`[getUserList] RPC search completed in ${duration.toFixed(2)}ms`);

      if (rpcError) {
        console.error(
          `[getUserList] RPC search error, falling back to in-memory filter:`,
          rpcError,
        );
        // Fall through to use original implementation as fallback
      } else if (searchResults) {
        // Transform RPC results to UserListItem format
        const users = searchResults.map(
          (row: {
            user_id: string;
            username: string;
            display_name: string;
            avatar_url: string | null;
            karma: number;
            followed_at: string;
          }) => ({
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            karma: row.karma,
            followedAt: row.followed_at,
          }),
        );

        const pageUsers = users.slice(0, safeLimit);
        const hasMore = users.length > safeLimit;

        // Check follow status if current user is logged in
        if (currentUserId && pageUsers.length > 0) {
          const userIds = pageUsers.map((u: UserListItem) => u.userId);
          const { data: followingData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", currentUserId)
            .in("following_id", userIds);

          const followingSet = new Set(followingData?.map((f) => f.following_id) || []);

          pageUsers.forEach((user: UserListItem) => {
            user.isFollowing = followingSet.has(user.userId);
          });
        }

        return {
          items: pageUsers,
          hasMore,
          nextCursor: hasMore ? pageUsers[pageUsers.length - 1].followedAt : undefined,
        };
      }
    } catch (err) {
      console.error(`[getUserList] Unexpected error in RPC search:`, err);
      // Fall through to use original implementation as fallback
    }
  }

  // ========================================
  // Original implementation (Phase 1)
  // ========================================
  // Used for non-search queries or as fallback if RPC fails

  // Dynamic foreign key and field names based on type
  const fkey =
    type === "followers"
      ? "follows_follower_id_fkey" // Join to get follower's profile
      : "follows_following_id_fkey"; // Join to get following's profile

  const filterField =
    type === "followers"
      ? "following_id" // Filter where following_id = userId (people who follow this user)
      : "follower_id"; // Filter where follower_id = userId (people this user follows)

  const selectField =
    type === "followers"
      ? "follower_id" // Select the follower's ID
      : "following_id"; // Select the following's ID

  // Build base query
  let query = supabase
    .from("follows")
    .select(
      `
      ${selectField},
      created_at,
      profiles!${fkey}(user_id, username, display_name, avatar_url, karma)
    `,
    )
    .eq(filterField, userId)
    .order("created_at", { ascending: false })
    .limit(pageLimit);

  // Apply cursor for pagination
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: follows, error } = await query;

  if (error) {
    console.error(`Error fetching ${type}:`, error);
    throw new Error(`Failed to fetch ${type}`);
  }

  if (!follows || follows.length === 0) {
    return { items: [], hasMore: false };
  }

  // Transform to UserListItem format
  let users = follows
    .map((follow) => {
      // Type assertion needed due to Supabase join typing
      const profile = follow.profiles as unknown as {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        karma: number;
      } | null;

      if (!profile) return null;

      return {
        userId: profile.user_id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        karma: profile.karma,
        followedAt: follow.created_at,
      };
    })
    .filter((item): item is UserListItem => item !== null);

  // Apply search filter (case-insensitive match on username or display name)
  // This is only used as fallback if RPC search fails
  if (search && search.trim()) {
    const searchLower = search.toLowerCase();
    users = users.filter(
      (user) =>
        user.username.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower),
    );
  }

  // Slice to get the actual page size (we fetched +1 to check for more)
  const pageUsers = users.slice(0, safeLimit);
  const hasMore = users.length > safeLimit;

  // Check follow status if current user is logged in
  // This allows UI to show follow/unfollow buttons with correct state
  if (currentUserId && pageUsers.length > 0) {
    const userIds = pageUsers.map((u) => u.userId);
    const { data: followingData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .in("following_id", userIds);

    const followingSet = new Set(followingData?.map((f) => f.following_id) || []);

    pageUsers.forEach((user) => {
      user.isFollowing = followingSet.has(user.userId);
    });
  }

  return {
    items: pageUsers,
    hasMore,
    nextCursor: hasMore ? pageUsers[pageUsers.length - 1].followedAt : undefined,
  };
}
