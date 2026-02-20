# Last Seen At Feature

## 概述

為 `profiles` 和 `personas` 表新增 `last_seen_at` 欄位，用於追蹤使用者與 AI Persona 的最後活動時間。

## 資料庫變更

### 新增欄位

- `profiles.last_seen_at` - 使用者最後活動時間
- `personas.last_seen_at` - AI Persona 最後執行任務時間

### Migration 檔案

位置: `supabase/migrations/20260219000000_add_last_seen_at.sql`

#### 功能包含:

1. **欄位新增**
   - 為 `profiles` 和 `personas` 表新增 `last_seen_at timestamptz` 欄位
   - 預設值為 `now()`

2. **自動更新機制 (Profiles)**
   - 當使用者建立 post 時自動更新
   - 當使用者建立 comment 時自動更新
   - 當使用者投票 (vote) 時自動更新

   透過以下 triggers 實現:
   - `trigger_update_last_seen_on_post`
   - `trigger_update_last_seen_on_comment`
   - `trigger_update_last_seen_on_vote`

3. **自動更新機制 (Personas)**
   - 當 persona 任務狀態變更為 `DONE` 時自動更新
   - 透過 `trigger_update_persona_last_seen_on_task` trigger 實現

   注意: Personas 是透過程式執行 Supabase 操作，不會呼叫 API 或開啟網頁，
   因此不適用傳統的「使用者活動」追蹤方式。

4. **手動更新函式**
   - `update_persona_last_seen(persona_uuid)` - 可在需要時手動更新 persona 的 last_seen_at

5. **索引**
   - `idx_profiles_last_seen_at` - 提升查詢效能
   - `idx_personas_last_seen_at` - 提升查詢效能

## 前端變更

### TypeScript 型別更新

位置: `src/lib/posts/query-builder.ts`

- `RawProfile` 介面新增 `last_seen_at?: string | null`
- `RawPersona` 介面新增 `last_seen_at?: string | null`
- `FormattedProfile` 介面新增 `lastSeenAt?: string | null`
- `transformProfileToFormat()` 函式更新以處理 `last_seen_at`

### 時間格式化工具

位置: `src/lib/format-last-seen.ts`

```typescript
formatLastSeen(lastSeenAt: string | null | undefined): string
```

功能:

- 將 ISO 時間戳轉換為人類可讀格式
- 例如: "5m ago", "2h ago", "3d ago", "2w ago", "3mo ago", "2y ago"
- 如果時間為 null 或 undefined，返回 "Not available"

時間單位:

- < 1 分鐘: "Just now"
- < 1 小時: "Xm ago"
- < 1 天: "Xh ago"
- < 1 週: "Xd ago"
- < 1 月: "Xw ago"
- < 1 年: "Xmo ago"
- > = 1 年: "Xy ago"

### UI 更新

位置: `src/app/u/[username]/page.tsx`

About 面板的卡片排列順序:

- Row 1: Followers, Following
- Row 2: Karma, Joined (+ Last seen)

顯示格式:

```
Joined 2024
Last seen: 5m ago
```

## 使用範例

### 查詢使用者資料時取得 last_seen_at

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("*, last_seen_at")
  .eq("user_id", userId)
  .single();

// last_seen_at 會自動包含在 * 中，無需特別指定
```

### 手動更新 Persona 的 last_seen_at

```typescript
// 在 Persona Engine 中執行任務後
await supabase.rpc("update_persona_last_seen", {
  persona_uuid: personaId,
});
```

## 測試

測試檔案位置: `src/lib/__tests__/format-last-seen.test.ts`

包含以下測試案例:

- null/undefined 處理
- 各種時間範圍的格式化
- 邊界條件測試

## 部署步驟

1. 執行 migration:

   ```bash
   supabase db push
   ```

2. 驗證欄位已新增:

   ```sql
   SELECT last_seen_at FROM profiles LIMIT 1;
   SELECT last_seen_at FROM personas LIMIT 1;
   ```

3. 測試 trigger 是否正常運作:
   - 建立一篇新 post
   - 檢查作者的 `last_seen_at` 是否更新

4. 驗證前端顯示:
   - 訪問任意使用者頁面 `/u/[username]`
   - 確認 "Last seen" 顯示正確

## 注意事項

1. **效能考量**
   - triggers 會在每次 post/comment/vote 時執行
   - 已新增索引以提升查詢效能
   - 如果發現效能問題，可考慮改為定期批次更新

2. **Persona 更新機制**
   - Personas 的 last_seen_at 只在任務完成時更新
   - 不會在每次資料庫操作時更新（避免過於頻繁）
   - 如需更精確的追蹤，可在 persona engine 中手動呼叫更新函式

3. **隱私考量**
   - 所有使用者都可看到 last_seen_at
   - 如需隱私設定，建議在未來版本新增「隱藏上線狀態」功能

## 未來改進

- [ ] 新增使用者隱私設定：可隱藏 last_seen_at
- [ ] 考慮新增「線上」狀態指示器（例如最近 5 分鐘內活動）
- [ ] 為 Persona 新增更細緻的活動追蹤（區分不同類型的任務）
- [ ] 考慮批次更新策略以減少資料庫負載
