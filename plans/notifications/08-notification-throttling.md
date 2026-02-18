# 08 - Notification Throttling & Aggregation

> **目標：** 實作通知節流和合併機制，避免用戶收到過多通知。

---

## 1. 規則總覽

| 通知類型 | 節流規則 |
|----------|----------|
| Upvote（文章/評論） | 里程碑式：1, 5, 10, 25, 50, 100, 250, 500, 1000... |
| 追蹤者發文 | 每篇最多通知 100 人 + 同作者 24h 內只通知一次 |
| Comment Reply | 無節流（每次都通知） |
| @mention | 無節流（每次都通知） |
| New Follower | 無節流（每次都通知） |

---

## 2. Upvote 里程碑通知

### 2.1 里程碑數值

```typescript
const UPVOTE_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

// 之後每 1000 一個里程碑
function getNextMilestone(currentScore: number): number | null {
  for (const m of UPVOTE_MILESTONES) {
    if (currentScore < m) return m;
  }
  // 超過 1000 後，每 1000 一個
  const next = Math.ceil(currentScore / 1000) * 1000;
  return next > currentScore ? next : next + 1000;
}

function shouldNotifyUpvote(oldScore: number, newScore: number): boolean {
  // 只有從低於里程碑變成等於里程碑時才通知
  for (const m of UPVOTE_MILESTONES) {
    if (oldScore < m && newScore >= m) return true;
  }
  // 檢查 1000 的倍數
  if (newScore >= 1000) {
    const oldThousands = Math.floor(oldScore / 1000);
    const newThousands = Math.floor(newScore / 1000);
    if (newThousands > oldThousands) return true;
  }
  return false;
}
```

### 2.2 修改投票 API

**更新 `src/app/api/votes/route.ts`：**

```typescript
import { shouldNotifyUpvote } from "@/lib/notification-throttle";

// 在 triggerUpvoteNotification 中
async function triggerUpvoteNotification(...) {
  if (postId) {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, title, score")
      .eq("id", postId)
      .single();

    if (post?.author_id && post.author_id !== voterId) {
      // 計算舊分數（當前分數減去這次的投票）
      const oldScore = post.score - 1;  // 因為 upvote 是 +1
      const newScore = post.score;

      // 只在達到里程碑時通知
      if (shouldNotifyUpvote(oldScore, newScore)) {
        await createNotification(post.author_id, NOTIFICATION_TYPES.POST_UPVOTE, {
          postId,
          postTitle: post.title,
          milestone: newScore,  // 新增：記錄達到的里程碑
        });
      }
    }
  }
  // ... comment upvote 類似處理
}
```

### 2.3 更新 Payload 類型

```typescript
export interface PostUpvotePayload {
  postId: string;
  postTitle: string;
  milestone?: number;  // 新增：達到的里程碑
}

export interface CommentUpvotePayload {
  postId: string;
  commentId: string;
  milestone?: number;  // 新增：達到的里程碑
}
```

### 2.4 更新通知訊息

```typescript
case NOTIFICATION_TYPES.POST_UPVOTE: {
  const p = payload as PostUpvotePayload;
  if (p.milestone) {
    return `Your post "${truncate(p.postTitle, 40)}" reached ${p.milestone} upvotes!`;
  }
  return `Your post "${truncate(p.postTitle, 50)}" received an upvote`;
}
```

---

## 3. 追蹤者發文通知節流

### 3.1 規則

1. **每篇文章最多通知 100 人**（優先通知最活躍的追蹤者）
2. **同一作者 24 小時內只通知一次**（避免高產作者轟炸）

### 3.2 實作方式

**建立 `src/lib/notification-throttle.ts`：**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_FOLLOWERS_TO_NOTIFY = 100;
const FOLLOWED_USER_POST_COOLDOWN_HOURS = 24;

/**
 * 獲取應該收到發文通知的追蹤者
 * 排除 24 小時內已經收到同作者通知的人
 */
export async function getFollowersToNotify(
  supabase: SupabaseClient,
  authorId: string,
): Promise<string[]> {
  // 1. 獲取追蹤者（最多 100 個）
  const { data: followers } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", authorId)
    .limit(MAX_FOLLOWERS_TO_NOTIFY);

  if (!followers || followers.length === 0) {
    return [];
  }

  const followerIds = followers.map((f) => f.follower_id);

  // 2. 檢查這些追蹤者 24 小時內是否已收到同作者的發文通知
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - FOLLOWED_USER_POST_COOLDOWN_HOURS);

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("type", "followed_user_post")
    .in("user_id", followerIds)
    .gte("created_at", twentyFourHoursAgo.toISOString())
    .contains("payload", { authorId });  // 檢查是同一作者

  const notifiedRecently = new Set(recentNotifications?.map((n) => n.user_id) || []);

  // 3. 排除已經通知過的人
  return followerIds.filter((id) => !notifiedRecently.has(id));
}
```

### 3.3 修改發文 API

**更新 `src/app/api/posts/route.ts`：**

```typescript
import { getFollowersToNotify } from "@/lib/notification-throttle";

// 在 POST handler 中，創建文章成功後：

// 獲取應該通知的追蹤者（已排除 24h 內通知過的）
const followersToNotify = await getFollowersToNotify(supabase, user.id);

if (followersToNotify.length > 0) {
  const { data: author } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("user_id", user.id)
    .single();

  const notifications = followersToNotify.map((followerId) => ({
    user_id: followerId,
    type: NOTIFICATION_TYPES.FOLLOWED_USER_POST,
    payload: {
      postId: post.id,
      postTitle: title,
      authorId: user.id,  // 用於 24h 節流檢查
      authorUsername: author?.username || "",
      authorDisplayName: author?.display_name || "Someone",
    },
  }));

  await supabase.from("notifications").insert(notifications);
}
```

---

## 4. 資料庫索引優化

為了支援節流查詢的效能，需要新增索引：

```sql
-- 支援 24h 內同作者通知查詢
CREATE INDEX IF NOT EXISTS idx_notifications_throttle 
  ON public.notifications(user_id, type, created_at DESC)
  WHERE type = 'followed_user_post';
```

---

## 5. 檔案結構

```
src/lib/
└── notification-throttle.ts   # 新增：節流邏輯
    ├── UPVOTE_MILESTONES
    ├── shouldNotifyUpvote()
    └── getFollowersToNotify()
```

---

## 6. 驗收標準

### Upvote 里程碑

- [ ] 第 1 個 upvote 時通知
- [ ] 第 5 個 upvote 時通知
- [ ] 第 10 個 upvote 時通知
- [ ] 第 2, 3, 4 個 upvote 時**不**通知
- [ ] 通知訊息顯示里程碑數字

### 追蹤者發文

- [ ] 發文時最多通知 100 個追蹤者
- [ ] 同一作者 24h 內只通知追蹤者一次
- [ ] 第二次發文時，已通知過的追蹤者不再收到通知

### 效能

- [ ] 索引已建立
- [ ] 大量追蹤者時 API 回應時間合理（< 500ms）
