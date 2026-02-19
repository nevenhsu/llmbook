// src/types/notification.ts

// ============================================================================
// Type Constants
// ============================================================================

export const NOTIFICATION_TYPES = {
  POST_UPVOTE: "post_upvote",
  COMMENT_UPVOTE: "comment_upvote",
  COMMENT_REPLY: "comment_reply",
  COMMENT_REPLY_TO_COMMENT: "comment_reply_to_comment",
  MENTION: "mention",
  NEW_FOLLOWER: "new_follower",
  FOLLOWED_USER_POST: "followed_user_post",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ============================================================================
// Payload Types
// ============================================================================

export interface PostUpvotePayload {
  postId: string;
  postTitle: string;
  milestone?: number; // Optional: reached milestone (1, 5, 10, 25, etc.)
}

export interface CommentUpvotePayload {
  postId: string;
  commentId: string;
  milestone?: number; // Optional: reached milestone (1, 5, 10, 25, etc.)
}

export interface CommentReplyPayload {
  postId: string;
  commentId: string;
  authorName: string;
  authorUsername: string;
  excerpt?: string;
}

export interface CommentReplyToCommentPayload {
  postId: string;
  parentCommentId: string;
  commentId: string;
  authorName: string;
  authorUsername: string;
  excerpt?: string;
}

export interface MentionPayload {
  postId?: string;
  commentId?: string;
  authorName: string;
  authorUsername: string;
  context: "post" | "comment";
}

export interface NewFollowerPayload {
  followerId: string;
  followerUsername: string;
  followerDisplayName: string;
  followerAvatarUrl?: string;
}

export interface FollowedUserPostPayload {
  postId: string;
  postTitle: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
}

export type NotificationPayload =
  | PostUpvotePayload
  | CommentUpvotePayload
  | CommentReplyPayload
  | CommentReplyToCommentPayload
  | MentionPayload
  | NewFollowerPayload
  | FollowedUserPostPayload;

// ============================================================================
// Database Types
// ============================================================================

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function getNotificationMessage(notification: NotificationRow): string {
  const { type, payload } = notification;

  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE: {
      const p = payload as PostUpvotePayload;
      if (p.milestone) {
        return `Your post "${truncate(p.postTitle, 40)}" reached ${p.milestone} upvotes!`;
      }
      return `Your post "${truncate(p.postTitle, 50)}" received an upvote`;
    }
    case NOTIFICATION_TYPES.COMMENT_UPVOTE: {
      const p = payload as CommentUpvotePayload;
      if (p.milestone) {
        return `Your comment reached ${p.milestone} upvotes!`;
      }
      return `Your comment received an upvote`;
    }
    case NOTIFICATION_TYPES.COMMENT_REPLY: {
      const p = payload as CommentReplyPayload;
      return `${p.authorName} commented on your post`;
    }
    case NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT: {
      const p = payload as CommentReplyToCommentPayload;
      return `${p.authorName} replied to your comment`;
    }
    case NOTIFICATION_TYPES.MENTION: {
      const p = payload as MentionPayload;
      return `${p.authorName} mentioned you in a ${p.context}`;
    }
    case NOTIFICATION_TYPES.NEW_FOLLOWER: {
      const p = payload as NewFollowerPayload;
      return `${p.followerDisplayName} started following you`;
    }
    case NOTIFICATION_TYPES.FOLLOWED_USER_POST: {
      const p = payload as FollowedUserPostPayload;
      return `${p.authorDisplayName} posted: "${truncate(p.postTitle, 40)}"`;
    }
    default:
      return "You have a new notification";
  }
}

export function getNotificationLink(notification: NotificationRow): string | null {
  const { type, payload } = notification;

  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE: {
      const p = payload as PostUpvotePayload;
      return `/posts/${p.postId}`;
    }
    case NOTIFICATION_TYPES.COMMENT_UPVOTE:
    case NOTIFICATION_TYPES.COMMENT_REPLY: {
      const p = payload as CommentUpvotePayload | CommentReplyPayload;
      return `/posts/${p.postId}#comment-${p.commentId}`;
    }
    case NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT: {
      const p = payload as CommentReplyToCommentPayload;
      return `/posts/${p.postId}#comment-${p.commentId}`;
    }
    case NOTIFICATION_TYPES.MENTION: {
      const p = payload as MentionPayload;
      if (p.commentId) {
        return `/posts/${p.postId}#comment-${p.commentId}`;
      }
      return p.postId ? `/posts/${p.postId}` : null;
    }
    case NOTIFICATION_TYPES.NEW_FOLLOWER: {
      const p = payload as NewFollowerPayload;
      return `/profile/${p.followerUsername}`;
    }
    case NOTIFICATION_TYPES.FOLLOWED_USER_POST: {
      const p = payload as FollowedUserPostPayload;
      return `/posts/${p.postId}`;
    }
    default:
      return null;
  }
}

export type NotificationIconType = "upvote" | "reply" | "mention" | "follow" | "post" | "default";

export function getNotificationIconType(type: NotificationType): NotificationIconType {
  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE:
    case NOTIFICATION_TYPES.COMMENT_UPVOTE:
      return "upvote";
    case NOTIFICATION_TYPES.COMMENT_REPLY:
    case NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT:
      return "reply";
    case NOTIFICATION_TYPES.MENTION:
      return "mention";
    case NOTIFICATION_TYPES.NEW_FOLLOWER:
      return "follow";
    case NOTIFICATION_TYPES.FOLLOWED_USER_POST:
      return "post";
    default:
      return "default";
  }
}
