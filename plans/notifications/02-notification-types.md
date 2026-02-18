# 02 - Notification Types Definition

> **目標：** 統一通知類型定義，確保前端 TypeScript 與 DB schema 一致。

---

## 1. 現狀問題

### 1.1 類型不一致

**現有前端 interface**（`src/app/notifications/page.tsx`）：
```typescript
interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;          // ❌ DB 沒有這個欄位
  related_id: string | null;  // ❌ DB 沒有這個欄位
  related_type: string | null; // ❌ DB 沒有這個欄位
  created_at: string;
  read_at: string | null;
}
```

**實際 DB schema**：
```sql
CREATE TABLE public.notifications (
  id uuid,
  user_id uuid,
  type text,
  payload jsonb,  -- ✅ 實際使用 JSONB
  read_at timestamptz,
  deleted_at timestamptz,  -- 新增
  created_at timestamptz
);
```

### 1.2 Type 值不一致

| 觸發位置 | 寫入的 type | 前端期望的 type |
|----------|-------------|-----------------|
| votes/route.ts | `UPVOTE` | `post_upvote` |
| votes/route.ts | `UPVOTE_COMMENT` | `comment_upvote` |
| comments/route.ts | `REPLY` | `comment_reply` |

---

## 2. 統一的通知類型

### 2.1 Type 常數定義

建立 `src/types/notification.ts`：

```typescript
/**
 * Notification type constants
 * 命名規則：{資源}_{動作} (snake_case, 全小寫)
 */
export const NOTIFICATION_TYPES = {
  // Post related
  POST_UPVOTE: 'post_upvote',
  
  // Comment related
  COMMENT_UPVOTE: 'comment_upvote',
  COMMENT_REPLY: 'comment_reply',      // 有人回覆文章（通知文章作者）
  COMMENT_REPLY_TO_COMMENT: 'comment_reply_to_comment', // 有人回覆你的評論
  
  // Social related
  MENTION: 'mention',
  NEW_FOLLOWER: 'new_follower',        // 有人追蹤你
  FOLLOWED_USER_POST: 'followed_user_post', // 你追蹤的人發文
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
```

### 2.2 Payload 類型定義

每種通知類型的 payload 結構：

```typescript
/**
 * Payload definitions for each notification type
 */
export interface PostUpvotePayload {
  postId: string;
  postTitle: string;
}

export interface CommentUpvotePayload {
  postId: string;
  commentId: string;
}

export interface CommentReplyPayload {
  postId: string;
  commentId: string;
  authorName: string;        // 發言者名稱
  authorUsername: string;    // 發言者 username（用於連結）
  excerpt?: string;          // 評論摘要（可選，限 100 字）
}

export interface CommentReplyToCommentPayload {
  postId: string;
  parentCommentId: string;   // 被回覆的評論 ID
  commentId: string;         // 新評論 ID
  authorName: string;
  authorUsername: string;
  excerpt?: string;
}

export interface MentionPayload {
  postId?: string;           // 在文章中被提及
  commentId?: string;        // 在評論中被提及
  authorName: string;
  authorUsername: string;
  context: 'post' | 'comment';
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

// Union type for all payloads
export type NotificationPayload = 
  | PostUpvotePayload
  | CommentUpvotePayload
  | CommentReplyPayload
  | CommentReplyToCommentPayload
  | MentionPayload
  | NewFollowerPayload
  | FollowedUserPostPayload;
```

### 2.3 完整的 Notification 介面

```typescript
/**
 * Database row type (matches Supabase schema)
 */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

/**
 * Frontend display type (with computed fields)
 */
export interface NotificationDisplay extends NotificationRow {
  // Computed fields for UI
  icon: React.ReactNode;
  message: string;
  link: string | null;
}
```

---

## 3. 類型守衛函數

用於 runtime 檢查 payload 類型：

```typescript
export function isPostUpvotePayload(
  type: NotificationType, 
  payload: unknown
): payload is PostUpvotePayload {
  return type === NOTIFICATION_TYPES.POST_UPVOTE && 
    typeof payload === 'object' && 
    payload !== null &&
    'postId' in payload;
}

export function isCommentReplyPayload(
  type: NotificationType, 
  payload: unknown
): payload is CommentReplyPayload {
  return type === NOTIFICATION_TYPES.COMMENT_REPLY && 
    typeof payload === 'object' && 
    payload !== null &&
    'postId' in payload &&
    'commentId' in payload;
}

// ... 其他類型守衛
```

---

## 4. 通知訊息生成函數

```typescript
/**
 * Generate human-readable message for notification
 */
export function getNotificationMessage(notification: NotificationRow): string {
  const { type, payload } = notification;
  
  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE: {
      const p = payload as PostUpvotePayload;
      return `Your post "${truncate(p.postTitle, 50)}" received an upvote`;
    }
    
    case NOTIFICATION_TYPES.COMMENT_UPVOTE: {
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
      return 'You have a new notification';
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
```

---

## 5. 通知連結生成函數

```typescript
/**
 * Generate link URL for notification click
 */
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
```

---

## 6. 通知圖標映射

```typescript
import { MessageSquare, ArrowUp, AtSign, UserPlus, FileText, Reply } from 'lucide-react';

export function getNotificationIcon(type: NotificationType): React.ReactNode {
  const iconProps = { size: 20 };
  
  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE:
    case NOTIFICATION_TYPES.COMMENT_UPVOTE:
      return <ArrowUp {...iconProps} className="text-upvote" />;
      
    case NOTIFICATION_TYPES.COMMENT_REPLY:
    case NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT:
      return <Reply {...iconProps} className="text-blue-500" />;
      
    case NOTIFICATION_TYPES.MENTION:
      return <AtSign {...iconProps} className="text-purple-500" />;
      
    case NOTIFICATION_TYPES.NEW_FOLLOWER:
      return <UserPlus {...iconProps} className="text-green-500" />;
      
    case NOTIFICATION_TYPES.FOLLOWED_USER_POST:
      return <FileText {...iconProps} className="text-accent" />;
      
    default:
      return <MessageSquare {...iconProps} className="text-base-content/70" />;
  }
}
```

---

## 7. Migration 指南：舊資料轉換

如果需要轉換現有的通知資料：

```sql
-- 轉換舊的 type 名稱
UPDATE notifications SET type = 'post_upvote' WHERE type = 'UPVOTE';
UPDATE notifications SET type = 'comment_upvote' WHERE type = 'UPVOTE_COMMENT';
UPDATE notifications SET type = 'comment_reply' WHERE type = 'REPLY';
```

---

## 8. 完整的 `src/types/notification.ts` 檔案

```typescript
// src/types/notification.ts

import { ReactNode } from 'react';
import { MessageSquare, ArrowUp, AtSign, UserPlus, FileText, Reply } from 'lucide-react';

// ============================================================================
// Type Constants
// ============================================================================

export const NOTIFICATION_TYPES = {
  POST_UPVOTE: 'post_upvote',
  COMMENT_UPVOTE: 'comment_upvote',
  COMMENT_REPLY: 'comment_reply',
  COMMENT_REPLY_TO_COMMENT: 'comment_reply_to_comment',
  MENTION: 'mention',
  NEW_FOLLOWER: 'new_follower',
  FOLLOWED_USER_POST: 'followed_user_post',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// ============================================================================
// Payload Types
// ============================================================================

export interface PostUpvotePayload {
  postId: string;
  postTitle: string;
}

export interface CommentUpvotePayload {
  postId: string;
  commentId: string;
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
  context: 'post' | 'comment';
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
  return str.slice(0, maxLength - 3) + '...';
}

export function getNotificationMessage(notification: NotificationRow): string {
  const { type, payload } = notification;
  
  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE: {
      const p = payload as PostUpvotePayload;
      return `Your post "${truncate(p.postTitle, 50)}" received an upvote`;
    }
    case NOTIFICATION_TYPES.COMMENT_UPVOTE:
      return `Your comment received an upvote`;
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
      return 'You have a new notification';
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
      if (p.commentId) return `/posts/${p.postId}#comment-${p.commentId}`;
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

export function getNotificationIcon(type: NotificationType): ReactNode {
  const iconProps = { size: 20 };
  
  switch (type) {
    case NOTIFICATION_TYPES.POST_UPVOTE:
    case NOTIFICATION_TYPES.COMMENT_UPVOTE:
      return <ArrowUp {...iconProps} className="text-upvote" />;
    case NOTIFICATION_TYPES.COMMENT_REPLY:
    case NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT:
      return <Reply {...iconProps} className="text-blue-500" />;
    case NOTIFICATION_TYPES.MENTION:
      return <AtSign {...iconProps} className="text-purple-500" />;
    case NOTIFICATION_TYPES.NEW_FOLLOWER:
      return <UserPlus {...iconProps} className="text-green-500" />;
    case NOTIFICATION_TYPES.FOLLOWED_USER_POST:
      return <FileText {...iconProps} className="text-accent" />;
    default:
      return <MessageSquare {...iconProps} className="text-base-content/70" />;
  }
}
```

---

## 9. 更新現有的 createNotification 函數

現有的 `src/lib/notifications.ts` 需要更新以支援類型安全：

**現有程式碼：**
```typescript
export async function createNotification(userId: string, type: string, payload: unknown) {
  // ...
}
```

**更新為：**
```typescript
import type { NotificationType, NotificationPayload } from "@/types/notification";

export async function createNotification(
  userId: string, 
  type: NotificationType, 
  payload: NotificationPayload
) {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });
  return { error };
}
```

這樣可以在編譯時檢查 type 和 payload 的一致性。

---

## 10. 驗收標準

- [ ] `src/types/notification.ts` 已建立
- [ ] 所有通知類型都有對應的 payload interface
- [ ] `getNotificationMessage` 函數可正確回傳訊息
- [ ] `getNotificationLink` 函數可正確回傳連結
- [ ] `getNotificationIcon` 函數可正確回傳圖標
- [ ] `src/lib/notifications.ts` 已更新為類型安全
- [ ] 舊的通知類型已透過 SQL migration 轉換
- [ ] 觸發通知的 API routes 已更新使用新的類型常數
- [ ] `npm run build` 無類型錯誤
