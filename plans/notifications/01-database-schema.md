# 01 - Database Schema Changes

> **目標：** 建立 Follow 系統的資料表，並為通知系統新增軟刪除欄位。

---

## 1. Follow System Schema

### 1.1 `follows` 表

用於儲存用戶之間的追蹤關係。

```sql
-- User follow relationships
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- 確保不能追蹤自己，且關係唯一
  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

-- 索引：查詢某人的粉絲、某人追蹤的人
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
```

### 1.2 `follows` 表 RLS 政策

```sql
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- 任何人可以查看追蹤關係（公開資訊）
CREATE POLICY "Follows are public" ON public.follows
  FOR SELECT USING (true);

-- 只有本人可以追蹤他人
CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- 只有本人可以取消追蹤
CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);
```

### 1.3 Profiles 表新增統計欄位（可選）

為了效能考量，可以在 `profiles` 表新增 follower/following 計數欄位。這是**可選的**，也可以用即時查詢。

```sql
-- 可選：在 profiles 新增計數欄位
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follower_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count int NOT NULL DEFAULT 0;

-- 維護計數的 trigger（可選，用於效能優化）
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE user_id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

---

## 2. Notifications Schema Updates

### 2.1 新增 `deleted_at` 欄位（軟刪除）

```sql
-- 新增軟刪除欄位
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 建立索引以加速查詢未刪除的通知
CREATE INDEX idx_notifications_not_deleted 
  ON public.notifications(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;
```

### 2.2 更新 RLS 政策

原本的政策已經足夠，但為了明確，可以更新：

```sql
-- 刪除舊政策（如果需要）
DROP POLICY IF EXISTS "Notifications are private" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage notifications" ON public.notifications;

-- 重新建立
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 注意：不提供 DELETE 政策，使用軟刪除
-- 如果需要真正刪除，應由 admin 或 scheduled job 處理
```

---

## 3. 完整 Migration 檔案

建議檔名：`supabase/migrations/00X_follows_and_notifications_v2.sql`

```sql
-- ============================================================================
-- Migration: Follow System + Notifications Soft Delete
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create follows table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- RLS for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are public" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ----------------------------------------------------------------------------
-- 2. Update profiles table (optional follow counts)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS follower_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count int NOT NULL DEFAULT 0;

-- Trigger to maintain counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(0, follower_count - 1) WHERE user_id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON public.follows;
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ----------------------------------------------------------------------------
-- 3. Update notifications table
-- ----------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index for efficient querying of non-deleted notifications
CREATE INDEX IF NOT EXISTS idx_notifications_not_deleted 
  ON public.notifications(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Grant permissions
-- ----------------------------------------------------------------------------

GRANT SELECT ON public.follows TO authenticated;
GRANT INSERT, DELETE ON public.follows TO authenticated;
```

---

## 4. 資料模型關係圖

```
┌─────────────────┐
│   auth.users    │
│─────────────────│
│ id (PK)         │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐         ┌─────────────────┐
│    profiles     │         │     follows     │
│─────────────────│         │─────────────────│
│ user_id (PK/FK) │◄────────│ follower_id(FK) │
│ username        │         │ following_id(FK)│──┐
│ display_name    │         │ created_at      │  │
│ follower_count  │         └─────────────────┘  │
│ following_count │                              │
└─────────────────┘◄─────────────────────────────┘


┌─────────────────────┐
│    notifications    │
│─────────────────────│
│ id (PK)             │
│ user_id (FK)        │
│ type                │
│ payload (JSONB)     │
│ read_at             │
│ deleted_at (NEW)    │  ← 軟刪除欄位
│ created_at          │
└─────────────────────┘
```

---

## 5. 驗證查詢

Migration 執行後，使用以下查詢驗證：

```sql
-- 驗證 follows 表
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'follows'
ORDER BY ordinal_position;

-- 驗證 notifications 表有 deleted_at
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications' AND column_name = 'deleted_at';

-- 驗證 profiles 表有計數欄位
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('follower_count', 'following_count');

-- 驗證 RLS 政策
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'follows';
```

---

## 6. 驗收標準

- [ ] `follows` 表已建立
- [ ] `follows` 表有正確的 RLS 政策
- [ ] `profiles` 表有 `follower_count` 和 `following_count` 欄位
- [ ] `notifications` 表有 `deleted_at` 欄位
- [ ] 所有索引已建立
- [ ] Trigger 正常運作（follow/unfollow 時計數更新）
- [ ] 驗證查詢全部通過
