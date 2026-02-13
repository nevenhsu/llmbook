# Migration Test Guide
# 測試 RLS Policies 和 Database Triggers

## Migration 檔案
- `20260213182407_add_board_member_policies_and_triggers.sql`

## 需要測試的功能

### 1. ✅ RLS Policy - 一般用戶離開 Board
**測試步驟：**
1. 以一般用戶身份登入
2. 加入一個 board
3. 離開該 board
4. 確認可以成功離開

**預期結果：**
- ✅ 成功 DELETE board_members record
- ✅ member_count 自動減 1（trigger）

---

### 2. ✅ RLS Policy - Moderator 踢除成員
**測試步驟：**
1. 以 moderator 身份登入
2. 前往 `/r/[slug]/member` 頁面
3. 嘗試踢除一般成員

**預期結果：**
- ✅ 成功 DELETE board_members record
- ✅ member_count 自動減 1（trigger）

---

### 3. ❌ RLS Policy - Moderator 無法踢除其他 Moderator
**測試步驟：**
1. 以 moderator 身份登入
2. 前往 `/r/[slug]/member` 頁面
3. 嘗試踢除另一個 moderator

**預期結果：**
- ❌ DELETE 失敗（RLS policy 阻止）
- ✅ 顯示錯誤訊息："Cannot kick moderators"

---

### 4. ✅ Database Trigger - 加入 Board
**測試步驟：**
1. 檢查 board 目前的 member_count
2. 加入該 board
3. 重新檢查 member_count

**預期結果：**
- ✅ member_count 自動 +1
- ✅ 不需要手動更新

---

### 5. ✅ Database Trigger - 離開 Board
**測試步驟：**
1. 檢查 board 目前的 member_count
2. 離開該 board
3. 重新檢查 member_count

**預期結果：**
- ✅ member_count 自動 -1
- ✅ 不會低於 0

---

### 6. ✅ 舊資料修正
**測試步驟：**
執行 migration 後，檢查所有 boards 的 member_count 是否正確

**SQL 查詢：**
```sql
SELECT 
  b.id,
  b.slug,
  b.member_count as stored_count,
  COUNT(bm.user_id) as actual_count,
  (b.member_count - COUNT(bm.user_id)) as difference
FROM boards b
LEFT JOIN board_members bm ON bm.board_id = b.id
GROUP BY b.id, b.slug, b.member_count
HAVING b.member_count != COUNT(bm.user_id);
```

**預期結果：**
- ✅ 沒有任何 row（所有 count 都正確）

---

## 執行 Migration

### Local Development (Supabase CLI)
```bash
supabase migration up
```

### Production
```bash
# 透過 Supabase Dashboard 執行
# 或使用 Supabase CLI
supabase db push
```

---

## Rollback Plan

如果需要 rollback，執行以下 SQL：

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS trg_update_board_member_count ON public.board_members;

-- Remove function
DROP FUNCTION IF EXISTS public.update_board_member_count();

-- Remove moderator policy
DROP POLICY IF EXISTS "Moderators can remove members" ON public.board_members;

-- Restore original policy (if needed)
-- (Original policy already exists, no need to recreate)
```

---

## 驗證成功標準

### ✅ RLS Policies
```sql
-- 檢查 policy 是否存在
SELECT * FROM pg_policies 
WHERE tablename = 'board_members' 
AND policyname = 'Moderators can remove members';
```

### ✅ Triggers
```sql
-- 檢查 trigger 是否存在
SELECT * FROM pg_trigger 
WHERE tgname = 'trg_update_board_member_count';
```

### ✅ Functions
```sql
-- 檢查 function 是否存在
SELECT * FROM pg_proc 
WHERE proname = 'update_board_member_count';
```

---

## 已移除的代碼

### ❌ 不再需要 createAdminClient 的檔案：
1. `src/app/r/[slug]/member/page.tsx` - 改用 createClient
2. `src/app/api/boards/[slug]/join/route.ts` - 改用 trigger
3. `src/app/api/boards/[slug]/members/[userId]/route.ts` - 改用 RLS policy

### ✅ 仍需要 createAdminClient 的檔案：
1. `src/app/api/auth/register/route.ts` - admin.createUser()
2. `src/app/api/auth/login/route.ts` - getUserById()
3. `src/app/api/media/upload/route.ts` - storage upload
