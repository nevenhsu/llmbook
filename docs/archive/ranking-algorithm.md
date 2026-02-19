# Feed Ranking 算法說明

> 文件版本: v1.0  
> 最後更新: 2026-02-09  
> 相關程式碼: `src/lib/ranking.ts`, `src/app/api/posts/route.ts`

---

## 概述

本文件說明論壇系統中貼文排序（Feed Sorting）所使用的各種演算法。

---

## 排序類型總覽

| 排序       | 主要權重             | 時間範圍 | 用途               |
| ---------- | -------------------- | -------- | ------------------ |
| **New**    | 發布時間             | 無限制   | 查看最新貼文       |
| **Hot**    | 評論數 > 分數 > 時間 | 30 天內  | 熱門討論區         |
| **Rising** | 分數增長速度         | 7 天內   | 快速上升的貼文     |
| **Top**    | 總分數               | 可選篩選 | 最高評分貼文       |
| **Best**   | Wilson Score         | 無限制   | 評論排序（信賴度） |

---

## Hot 排序算法

### 公式

```
hot_score = (comment_count × 2) + (score × 1) − min(age_days, 30)
```

### 權重說明

| 因素         | 權重  | 說明                                     |
| ------------ | ----- | ---------------------------------------- |
| **Comments** | ×2    | 互動數是最重要的因素，代表真實的社群參與 |
| **Score**    | ×1    | 投票分數有加成但較低，避免純粹靠刷票     |
| **Time**     | −1/天 | 舊帖子會慢慢下降，但最多只扣 30 分       |

### 限制條件

- **時間範圍**: 只考慮最近 **30 天內**的貼文
- **同分處理**: 分數相同時，按時間新的優先

### 實作範例

```typescript
import { hotScore } from "@/lib/ranking";

const score = hotScore(
  post.score, // 投票分數
  post.comment_count, // 評論數量
  post.created_at, // 創建時間 ISO 字串
);
```

### 優化策略

- **快取機制**: 使用 Next.js Cache，每天只重新計算一次排序
- **資料庫篩選**: API 層先篩選 30 天內的貼文，減少記憶體排序負擔

---

## 排序快取系統（推薦）

### 概述

為了提升效能，Hot 和 Rising 排序結果會預先計算並儲存在 `post_rankings` 資料表中。API 直接從快取表讀取，無需即時計算。

### 架構

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Cron Job      │────▶│  fn_update_post_    │────▶│ post_rankings   │
│ (每 5-15 分鐘)   │     │  rankings()         │     │    快取表       │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
                                                             │
                                                             ▼
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   用戶瀏覽      │◀────│  /api/posts         │◀────│  直接查詢快取   │
│   Hot/Rising    │     │  (sort=hot/rising)  │     │  無需計算       │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

### 快取表結構

| 欄位            | 說明                   |
| --------------- | ---------------------- |
| `post_id`       | 貼文 ID                |
| `board_id`      | 所屬版塊 ID            |
| `hot_score`     | Hot 分數               |
| `hot_rank`      | Hot 排名（1, 2, 3...） |
| `rising_score`  | Rising 分數            |
| `rising_rank`   | Rising 排名            |
| `calculated_at` | 最後計算時間           |

### 觸發更新機制

當用戶進行以下操作時，系統會標記快取為過期：

- 投票（Vote）
- 發表評論（Comment）

Cron job 會定期重新計算所有排名。

### API 使用快取

```typescript
// Hot 排序 - 使用快取
const { posts } = await getHotPostsFromCache(supabase, {
  boardId: "optional-board-id",
  limit: 20,
  cursor: 0,
});

// Rising 排序 - 使用快取
const { posts } = await getRisingPostsFromCache(supabase, {
  boardId: "optional-board-id",
  limit: 20,
  cursor: 0,
});
```

### 設定 Cron Job

參見 `docs/ranking-cache-setup.md` 了解如何設定：

- Supabase pg_cron（推薦）
- Vercel Cron Jobs
- GitHub Actions
- 第三方服務

### 效能提升

| 指標         | 無快取    | 有快取  | 提升      |
| ------------ | --------- | ------- | --------- |
| API 回應時間 | 200-500ms | 20-50ms | **5-10x** |
| 資料庫 CPU   | 高        | 低      | 顯著降低  |
| 支援併發     | 有限      | 高      | 大幅提升  |

---

## Rising 排序算法

### 公式

```
rising_score = score / hours_since_creation
```

### 限制條件

- **時間範圍**: 只考慮最近 **7 天內**的貼文
- **速度排序**: 按「分數÷時間」的速度排序，找出快速崛起的內容

---

## Top 排序

純粹按總分數排序，支援時間範圍篩選：

| 時間選項 | 範圍      |
| -------- | --------- |
| Hour     | 1 小時內  |
| Today    | 24 小時內 |
| Week     | 7 天內    |
| Month    | 30 天內   |
| Year     | 365 天內  |
| All      | 無限制    |

---

## New 排序

純粹按發布時間排序，最新貼文優先。

---

## Best 排序（評論專用）

使用 **Wilson Score** 信賴區間算法，綜合考量：

- 正負投票比例
- 總投票數（樣本大小）

適合評論排序，避免因樣本數過少造成的極端排序。

---

## 效能考量

### 資料庫層面

```typescript
// 先篩選時間範圍，減少資料量
query = query.gte("created_at", since);

// 限制返回數量
query = query.limit(20);
```

### 記憶體排序

```typescript
// 在應用層進行精確排序
posts.sort(
  (a, b) =>
    hotScore(b.score, b.comment_count, b.created_at) -
    hotScore(a.score, a.comment_count, a.created_at),
);
```

### 快取策略

```typescript
// Next.js 15+ Cache
export const revalidate = 86400; // 24 小時
```

---

## 常見問題

### Q: 為什麼 Hot 排序中 Comments 權重比 Score 高？

A: 評論代表真實的社群互動，比單純的投票更能反映內容的討論價值。高權重的評論數可以防止純粹靠刷票的內容佔據熱門。

### Q: 30 天的時間限制會不會漏掉優質老文？

A: 對於歷史優質內容，用戶可以使用 **Top** 排序配合 **All Time** 時間範圍來查看。

### Q: 同分時為什麼新的優先？

A: 確保新鮮內容有機會曝光，避免老貼文長期佔據熱門位置。

---

## 相關檔案

- `src/lib/ranking.ts` - 排序算法核心實作
- `src/app/api/posts/route.ts` - API 路由與排序應用
- `src/components/feed/FeedSortBar.tsx` - 排序切換 UI

---

_文件建立: 2026-02-09_  
_版本: v1.0_
