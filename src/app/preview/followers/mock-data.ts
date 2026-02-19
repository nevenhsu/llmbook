import type { UserListItem } from "@/types/user";

export const MOCK_FOLLOWERS: UserListItem[] = [
  {
    userId: "user-1",
    username: "alice_wonderland",
    displayName: "Alice Wonderland",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
    karma: 1250,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    isFollowing: true,
  },
  {
    userId: "user-2",
    username: "bob_builder",
    displayName: "Bob the Builder",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
    karma: 890,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    isFollowing: false,
  },
  {
    userId: "user-3",
    username: "charlie_chaplin",
    displayName: "Charlie Chaplin",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie",
    karma: 2340,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    isFollowing: true,
  },
  {
    userId: "user-4",
    username: "diana_prince",
    displayName: "Diana Prince",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=diana",
    karma: 5670,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 1 week ago
    isFollowing: true,
  },
  {
    userId: "user-5",
    username: "edward_elric",
    displayName: "Edward Elric",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=edward",
    karma: 3420,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 2 weeks ago
    isFollowing: false,
  },
  {
    userId: "user-6",
    username: "fiona_apple",
    displayName: "Fiona Apple",
    avatarUrl: null,
    karma: 156,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 1 month ago
    isFollowing: false,
  },
];

export const MOCK_FOLLOWING: UserListItem[] = [
  {
    userId: "user-7",
    username: "george_rr_martin",
    displayName: "George R.R. Martin",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=george",
    karma: 8900,
    followedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    isFollowing: true,
  },
  {
    userId: "user-8",
    username: "hermione_granger",
    displayName: "Hermione Granger",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=hermione",
    karma: 12400,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    isFollowing: true,
  },
  {
    userId: "user-9",
    username: "iron_man",
    displayName: "Tony Stark",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=tony",
    karma: 15600,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    isFollowing: true,
  },
  {
    userId: "user-10",
    username: "jane_austen",
    displayName: "Jane Austen",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
    karma: 7890,
    followedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
    isFollowing: true,
  },
];

export function getMockFollowers(cursor?: string, limit = 20) {
  let items = MOCK_FOLLOWERS;

  if (cursor) {
    const cursorIndex = items.findIndex((u) => u.followedAt === cursor);
    if (cursorIndex !== -1) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const pageItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  return {
    items: pageItems,
    hasMore,
    nextCursor: hasMore ? pageItems[pageItems.length - 1].followedAt : undefined,
  };
}

export function getMockFollowing(cursor?: string, limit = 20) {
  let items = MOCK_FOLLOWING;

  if (cursor) {
    const cursorIndex = items.findIndex((u) => u.followedAt === cursor);
    if (cursorIndex !== -1) {
      items = items.slice(cursorIndex + 1);
    }
  }

  const pageItems = items.slice(0, limit);
  const hasMore = items.length > limit;

  return {
    items: pageItems,
    hasMore,
    nextCursor: hasMore ? pageItems[pageItems.length - 1].followedAt : undefined,
  };
}
