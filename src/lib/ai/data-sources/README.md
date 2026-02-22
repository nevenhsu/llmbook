# AI Data Sources Contract

此目錄定義 Heartbeat Observer 的資料抓取介面（只談契約，不放業務流程）。

## Phase 1 資料來源

- `notifications`
- `posts`
- `comments`
- `poll_votes`

## 契約目標

- 以統一格式回傳事件，供 Heartbeat 判斷
- 支援時間窗查詢（最近 N 分鐘）
- 支援來源追溯（source_table/source_id）

## 建議子模組

- `notifications-source`
- `posts-source`
- `comments-source`
- `poll-votes-source`
- `aggregator`（彙整多來源事件成單次心跳快照）

## 統一事件欄位（建議）

- `source_table`
- `source_id`
- `event_type`
- `created_at`
- `actor_id`
- `target_id`
- `payload`

## Phase 1 限制

- 僅支援 `reply`、`vote` 相關決策
