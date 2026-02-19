// src/app/preview/notifications/mock-data.ts

import { NotificationRow, NOTIFICATION_TYPES } from "@/types/notification";

// 使用固定的基準時間（避免 hydration mismatch）
const BASE_TIME = "2026-02-19T12:00:00Z";

// 生成假時間（過去幾分鐘）
const ago = (minutes: number) => {
  const date = new Date(BASE_TIME);
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

export const MOCK_NOTIFICATIONS: NotificationRow[] = [
  // Post Upvote - 未讀 (milestone)
  {
    id: "mock-001",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.POST_UPVOTE,
    payload: {
      postId: "post-1",
      postTitle: "How to build a Reddit clone with Next.js and Supabase",
      milestone: 100,
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(2),
  },

  // Post Upvote - 未讀 (normal)
  {
    id: "mock-002",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.POST_UPVOTE,
    payload: {
      postId: "post-2",
      postTitle: "Understanding React Server Components",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(5),
  },

  // Comment Reply - 未讀
  {
    id: "mock-003",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_REPLY,
    payload: {
      postId: "post-3",
      commentId: "comment-1",
      authorName: "Alice Chen",
      authorUsername: "alice",
      excerpt: "Great article! I learned a lot from this.",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(15),
  },

  // Comment Reply to Comment - 未讀
  {
    id: "mock-004",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT,
    payload: {
      postId: "post-4",
      parentCommentId: "comment-2",
      commentId: "comment-3",
      authorName: "Bob Smith",
      authorUsername: "bobsmith",
      excerpt: "I totally agree with your point about TypeScript...",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(30),
  },

  // Mention in comment - 未讀
  {
    id: "mock-005",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.MENTION,
    payload: {
      postId: "post-5",
      commentId: "comment-4",
      authorName: "Carol Davis",
      authorUsername: "carol",
      context: "comment" as const,
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(45),
  },

  // Mention in post - 已讀
  {
    id: "mock-006",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.MENTION,
    payload: {
      postId: "post-6",
      authorName: "David Lee",
      authorUsername: "davidlee",
      context: "post" as const,
    },
    read_at: ago(20),
    deleted_at: null,
    created_at: ago(60),
  },

  // New Follower - 已讀
  {
    id: "mock-007",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.NEW_FOLLOWER,
    payload: {
      followerId: "follower-1",
      followerUsername: "techguru",
      followerDisplayName: "Tech Guru",
      followerAvatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=techguru",
    },
    read_at: ago(40),
    deleted_at: null,
    created_at: ago(120),
  },

  // Followed User Post - 已讀
  {
    id: "mock-008",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.FOLLOWED_USER_POST,
    payload: {
      postId: "post-7",
      postTitle: "Announcing our new AI features for developers",
      authorId: "author-1",
      authorUsername: "productteam",
      authorDisplayName: "Product Team",
    },
    read_at: ago(50),
    deleted_at: null,
    created_at: ago(180),
  },

  // Comment Upvote (milestone) - 已讀
  {
    id: "mock-009",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_UPVOTE,
    payload: {
      postId: "post-8",
      commentId: "comment-5",
      milestone: 25,
    },
    read_at: ago(100),
    deleted_at: null,
    created_at: ago(240),
  },

  // Comment Upvote (normal) - 已讀
  {
    id: "mock-010",
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_UPVOTE,
    payload: {
      postId: "post-9",
      commentId: "comment-6",
    },
    read_at: ago(120),
    deleted_at: null,
    created_at: ago(300),
  },

  // More notifications for pagination testing...
  ...Array.from(
    { length: 15 },
    (_, i) =>
      ({
        id: `mock-${String(i + 11).padStart(3, "0")}`,
        user_id: "mock-user",
        type:
          i % 3 === 0
            ? NOTIFICATION_TYPES.POST_UPVOTE
            : i % 3 === 1
              ? NOTIFICATION_TYPES.COMMENT_REPLY
              : NOTIFICATION_TYPES.NEW_FOLLOWER,
        payload:
          i % 3 === 0
            ? {
                postId: `post-${i + 10}`,
                postTitle: `Sample post title number ${i + 1}`,
              }
            : i % 3 === 1
              ? {
                  postId: `post-${i + 10}`,
                  commentId: `comment-${i + 10}`,
                  authorName: `User ${i + 1}`,
                  authorUsername: `user${i + 1}`,
                }
              : {
                  followerId: `follower-${i + 2}`,
                  followerUsername: `user${i + 1}`,
                  followerDisplayName: `User ${i + 1}`,
                },
        read_at: i % 4 === 0 ? null : ago(360 + i * 60),
        deleted_at: null,
        created_at: ago(360 + i * 60),
      }) as NotificationRow,
  ),
];

// 模擬分頁
export function getMockNotifications(cursor?: string, limit: number = 20) {
  let startIndex = 0;

  if (cursor) {
    const cursorIndex = MOCK_NOTIFICATIONS.findIndex((n) => n.created_at === cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  const items = MOCK_NOTIFICATIONS.slice(startIndex, startIndex + limit + 1);
  const hasMore = items.length > limit;

  if (hasMore) {
    items.pop();
  }

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : undefined;

  return { items, hasMore, nextCursor };
}

// 取得最近 N 筆通知（用於 bell dropdown）
export function getRecentMockNotifications(limit: number = 5) {
  return MOCK_NOTIFICATIONS.slice(0, limit);
}
