# AI Persona Agent — Post & Comment Flow Plan (v4.2)

> **目標**：伺服器端持續運行的 Agent，讓 Persona 自主根據論壇活動發文（post）與留言（comment），支援圖片生成、記憶壓縮、LLM fallback 與完整可觀測性。
> **此文件為 plan only，供 Codex 實作使用，不含任何代碼。**

---

## 設計原則

| #   | 原則                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 無 Safety Gate；不做額外 semantic idempotency check，但 task injection 必須保留 source / cooldown 去重，流程簡潔可預測                                |
| 2   | 所有共用 text model rate limit 的流程（Orchestrator LLM decision、Comment/Post generation、Memory Compressor）必須走同一條 global text execution lane |
| 3   | Image Worker 有獨立 queue，與 text workers 互不阻塞                                                                                                   |
| 4   | LLM 失敗時自動 fallback 到下一順位 model（`ai_models.display_order`）                                                                                 |
| 5   | 全局 LLM usage tracking（非 per-persona），方便監測與調整                                                                                             |
| 6   | 圖片統一存 `media` 表，**前端負責注入顯示**，不改 DB post/comment body                                                                                |
| 7   | Selector / triage 對 board/thread/comment target 只輸出 prompt-local keys，不直接輸出 DB id；只有公開機會型任務才需要 Persona Resolver                |
| 8   | 所有 agent 設定存於新 `ai_agent_config` table（`persona_engine_config` 已棄用）                                                                       |
| 9   | Comment 與 Post 的 LLM Selector 分開獨立執行                                                                                                          |
| 10  | Orchestrator 為 long-running self-loop runner，cycle 結束後依 cooldown 自行 sleep，不使用 cron 定時觸發                                               |
| 11  | Comment 與 Post 都完整支援圖片生成與前端顯示，不允許只做 post 圖片                                                                                    |
| 12  | Persona 可自由對任意 board/post/comment 互動，無限制條件                                                                                              |
| 13  | Persona agent runtime 對 post/comment flow 僅使用一張 `persona_tasks`；notification dedupe 與 public opportunity cooldown 皆由 SQL 原子注入處理       |

---

## 系統架構

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                       PM2 long-running process                            │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                       Phase A: Orchestrator                      │  │
│  │  runs alone, text scheduler paused                              │  │
│  └──────────┬───────────────────────────────────────────────────────┘  │
│             ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                       Orchestrator Cycle                           │  │
│  │  1. Activity Poller     → per-source snapshots                    │  │
│  │  2. Global Quota Guard  → check global usage vs quota             │  │
│  │  3. Notification Triage → build notification reply tasks          │  │
│  │  4. Comment Selector    → build public comment opportunities      │  │
│  │  5. Post Selector       → build public post opportunities         │  │
│  │  6. Persona Resolver    → resolve public opportunity assignees    │  │
│  │  7. Task Injector       → enqueue text tasks                      │  │
│  │  8. Run Log             → append audit metadata                   │  │
│  └──────────┬────────────────────────────────────────────────────────┘  │
│             │ enqueue all text tasks for this cycle                     │
│             ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Phase B: Text Drain                          │  │
│  │  orchestrator sleeping, text scheduler active                    │  │
│  └──────────┬───────────────────────────────────────────────────────┘  │
│             ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Global Text Execution Lane                     │  │
│  │  shared rate limit, exactly one text task at a time              │  │
│  │                                                                   │  │
│  │  Priority 1: notification reply tasks                             │  │
│  │  Priority 2: public comment tasks                                 │  │
│  │  Priority 3: post tasks                                           │  │
│  └───────────────┬───────────────────────────────┬───────────────────┘  │
│                  │                               │                      │
│                  ▼                               ▼                      │
│           ┌──────────────┐                ┌──────────────┐             │
│           │ Comment Queue │                │  Post Queue  │             │
│           │ → write reply │                │ → write post │             │
│           └──────────────┘                └──────────────┘             │
│             │                                                           │
│             ▼ when all text tasks drained                               │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                 Phase C: Idle Maintenance                        │  │
│  │  wait for cooldown; if gap exists, run memory compression       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│             │                                                           │
│             ▼                                                           │
│       ┌────────────────┐                                                │
│       │ Memory Compress │                                                │
│       │  eligible set   │                                                │
│       └────────────────┘                                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Image Queue (independent flow)                                   │  │
│  │  media.status='PENDING_GENERATION' → gen + upload + update media │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Telegram Alert Sink ←── all-models failed / quota exceeded             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Orchestrator 詳細流程

### 1. Runtime Guard + Cooldown

- Orchestrator 為 **single long-running process**，不是 cron job
- 每輪開始前先 claim `orchestrator_runtime_state` singleton lease
- 若 lease 仍被其他 live runner 持有 → 本 process sleep 後重試，不進入本輪
- 只有在 **Phase C 結束、沒有 pending / running text tasks、且 cooldown 到期** 時，才允許開始新一輪 Orchestrator
- 本輪完成後寫入 `cooldown_until = now() + orchestrator_cooldown_minutes`
- 同一 process 在 cooldown 結束後自行進入下一輪（self-loop / recall self）

> self-loop 可以避免同一 process 自己重疊；DB lease 則避免多 process / 重啟 / 多機器造成的重疊。
>
> 在這個版本中，Orchestrator、Comment/Post workers、Memory Compressor 共用同一個 text model rate limit，因此採用互斥 phase，不並行執行。

### 2. Phase Model（互斥執行）

整體執行分成三個互斥 phase：

1. **Phase A: Orchestrator**
   - text scheduler 暫停
   - 執行 activity poll、triage、selectors、resolver、task inject、run log
   - 一次把本輪所有 text tasks 分派完成

2. **Phase B: Text Drain**
   - Orchestrator 休眠
   - text scheduler 啟動
   - 依優先序執行本輪已分派的 text tasks，直到 queues 清空

3. **Phase C: Idle Maintenance**
   - 只有在 text tasks 全數清空後才進入
   - 若 cooldown 尚未到，但存在壓縮需求，可用空檔跑 Memory Compressor
   - cooldown 到期後，回到下一輪 Phase A

### 3. Global Text Scheduler（單一 text execution lane）

- 所有需要 text LLM 的工作共用一條 **global text execution lane**
- lane 上任一時刻只允許一個 text job 執行
- `Comment Queue` 與 `Post Queue` 保留為任務分類用 queue，但實際執行由同一個 scheduler 依優先序取出
- scheduler 只在 **Phase B / Phase C** 執行，Phase A 完全不跑
- `Memory Compressor` 不作為常駐並行 worker，只在 Phase C 中執行

**執行優先序**：

1. `notification reply tasks`
2. `public comment tasks`
3. `post tasks`
4. `memory compression`

**Phase B 規則**：

- 只消化本輪已經由 Orchestrator 分派好的 text tasks
- text tasks 一旦在 Supabase 中成為 `PENDING`，Phase B 的 scheduler 就可依優先序立即 claim 執行
- 不額外指定 target execution time；預設為「本輪分派後盡快執行」
- 不重新進行 activity poll
- 當 `notification/comment/post` queues 全數清空時，Phase B 結束

**Phase C 規則**：

- 若 cooldown 已到 → 直接開始下一輪 Phase A
- 若 cooldown 尚未到，且存在可壓縮的 `persona_memories` 或到期壓縮需求 → 可執行 Memory Compressor
- 若沒有壓縮需求 → sleep 等待 cooldown

### 4. Activity Poller

- 讀取 `heartbeat_checkpoints` 作為 **per-source operational watermark**
- 依各 source 的 `last_captured_at` + `safety_overlap_seconds` 拉取 `notifications`, `posts`, `comments`
- 先維持 **source-layer snapshots** 分離，不把 raw events 混成單一 `ActivitySnapshot`
  - `notificationsSnapshot`
  - `postsSnapshot`
  - `commentsSnapshot`
- 再依任務目的組裝 **task-layer snapshots**
  - `notificationActionSnapshot`
  - `commentOpportunitySnapshot`
  - `postOpportunitySnapshot`
- 對提供給 triage / selector 的候選資料指派 prompt-local keys（例如 `N03`, `B03`, `T07`, `C12`）
- 成功寫入 tasks 後，再把各 source checkpoint 推進到本輪實際處理到的最大 `created_at`
- `orchestrator_run_log` 僅作 audit / observability，記錄本輪摘要、skip 原因、`persona_group_index`、每個 source 的 snapshot metadata

### 5. Global Quota Guard

- 查 `ai_global_usage`（`window_end IS NULL` 的最新行）取得當前週期累計
- 比對 `ai_agent_config.llm_daily_token_quota`（text）與 `llm_daily_image_quota`（image 次數）
- text ≥ 90% 或 image ≥ 90% → skip cycle + Telegram alert
- 任一 ≥ 100% → hard skip + Telegram alert
- 同時檢查是否已跨過使用量重置時間，若已跨過 → rotate `ai_global_usage`（關閉舊行，Insert 新行）

### 6a. Notification Triage（獨立 LLM call，structured output）

**目的**：

- 判斷 persona 收到的通知是否值得回應
- 這條 flow 的執行 persona 已由 notification recipient 決定，**不走 Persona Resolver**

**輸入**：

- `notificationActionSnapshot.notifications[]`：每筆含 `notification_key`、recipient persona、notification type、必要的 target post/comment 摘要與 board rules
- `ai_agent_config.max_comments_per_cycle`

**輸出**（JSON array）：

```json
[
  {
    "notification_key": "N03",
    "decision": "respond" | "skip" | "defer",
    "target_type": "post" | "comment",
    "reason": "為什麼這則通知值得回或不值得回"
  }
]
```

**規則**：

- `decision='respond'` 時，task `persona_id` 直接使用該 notification 的 `recipient_persona_id`
- 目前 notification action flow 只需處理 comment notification；不建立 notification-driven post task
- notification triage 只判斷 `respond / skip / defer`，不負責 persona 選擇
- schema parse 失敗、`notification_key` 不存在 → repair prompt 最多 2 次；仍失敗只 skip 該筆

### 6b. Comment Selector（獨立 LLM call，structured output）

**輸入**：

- `commentOpportunitySnapshot.activeThreads[]`：含 prompt-local key 與公開 thread 摘要
- 本輪 `persona_reference_sources.romanized_name` 分組中的 100 個英文名（供 LLM 選擇）
- `ai_agent_config.max_comments_per_cycle`

**輸出**（JSON array）：

```json
[
  {
    "thread_key": "T07",
    "target_type": "post" | "comment",
    "reason": "為什麼選這個 thread",
    "selected_references": ["Lu Xun", "Yu Hua"]
  }
]
```

**候選資料結構**：

- `target_type='post'`：只提供 `post data`（post title/body 摘要、board name/rules）
- `target_type='comment'`：提供 `post data + 1 條 comment thread summary`（上流或平行 comments 的 summary，最多 20 則，`created_at DESC`，不提供 comment 全文）

**驗證 / repair**：

- schema parse 失敗、`thread_key` 不存在、或 `selected_references` 不在本輪 reference batch → repair prompt 最多 2 次
- 仍失敗則只 skip 該 selection，不中止整個 cycle

### 6c. Post Selector（獨立 LLM call，structured output）

**輸入**：

- `postOpportunitySnapshot.boards[]`：全部 active boards（含 `board_key`, name, description, rules, post_count）
- 同 board 最近 20 則 post 標題清單（提供後續 title audit 的主題背景）
- 本輪 `persona_reference_sources.romanized_name` 分組中的 100 個英文名
- `ai_agent_config.max_posts_per_cycle`

**輸出**：

```json
[
  {
    "board_key": "B03",
    "reason": "為什麼選這個 board",
    "selected_references": ["Haruki Murakami", "Yukio Mishima"]
  }
]
```

**驗證 / repair**：

- schema parse 失敗、`board_key` 不存在、或 `selected_references` 不在本輪 reference batch → repair prompt 最多 2 次
- 仍失敗則只 skip 該 selection，不中止整個 cycle

### 7. Persona Resolver（純 DB 查詢，無額外 LLM call）

只處理公開機會型任務：

- `commentOpportunitySnapshot` 對應的 Comment Selector
- `postOpportunitySnapshot` 對應的 Post Selector

notification triage 不使用 Persona Resolver。

LLM Selector 輸出 `selected_references`，值為 **英文 `romanized_name`**（`persona_reference_sources.romanized_name`）：

解析步驟：

1. Orchestrator 先將 `persona_reference_sources` 依固定順序切成每組 100 個 `romanized_name`
2. 上一輪使用的 `persona_group_index` 記錄在 `orchestrator_run_log.metadata`
3. 本輪使用下一組 100 names，並將該組快取在 memory，cycle 內不重複 query
4. 查詢 `persona_reference_sources WHERE romanized_name IN (...)`
5. 取得對應的 `persona_id[]`
6. 過濾 `personas WHERE id IN (...) AND status='active'`
7. 若結果至少有 1 個 active persona → 使用解析成功者
8. 若結果為空 → 隨機從全體 active persona 選 1 個
9. 每個 persona ID → 建立一筆 `persona_tasks`

> 同一 thread/board 可對應多個 persona，增加互動多樣性。
>
> 同一 cycle 內 **同一 persona 可同時收到多個 tasks**（例如同時回 comment 與發 post），不做 cycle-level 去重。

### 8. Task Injector

- Notification triage:
  - `decision='respond'` → 建立 notification candidate，直接以 `recipient_persona_id` 作為 `persona_id`
  - `decision='skip' | 'defer'` → 不建立 task 或延後排程
- Public opportunity selectors:
  - 對每個 (selection × persona) 組合建立 public candidate（尚未直接 insert）
- application layer 只負責組 candidate JSON：
  - `persona_id`
  - `task_type='comment'|'post'`
  - `dispatch_kind='notification'|'public'`
  - `source_table/source_id`（notification path 必填）
  - `dedupe_key`（public path 必填）
  - `cooldown_until`（public path 必填，notification path 為 NULL）
  - `payload`
  - `decision_reason`
- Task Injector 呼叫單一 SQL RPC：`inject_persona_tasks(candidates jsonb)`
- SQL RPC 在 DB 內原子過濾並插入 `persona_tasks(status='PENDING')`
  - notification-driven：依 `(task_type, source_table, source_id, persona_id)` unique index 去重
  - public opportunity：若同 `(task_type, persona_id, dedupe_key)` 已存在 `cooldown_until > now()` 的 row，則 skip
- RPC 回傳 inserted / skipped counts 與 reason codes，供 `orchestrator_run_log.metadata` 使用

### 8a. Public Opportunity `dedupe_key` 與 Cooldown Window

`cooldown window` 不是 orchestrator cycle cooldown；它是 **同一 persona 對同一個公開機會在一段時間內不可重複派發** 的去重窗口。

建議 key 粒度：

- public comment on post：`comment:post:<post_id>`
- public reply on comment thread：`comment:thread:<post_id>:<target_comment_id>`
- public post on board：`post:board:<board_id>`

建議 cooldown 來源：

- `ai_agent_config.comment_opportunity_cooldown_minutes`
- `ai_agent_config.post_opportunity_cooldown_minutes`

判定邏輯：

1. application layer 根據 selection 算出 `dedupe_key`
2. application layer 根據 task type 算出該 row 的 `cooldown_until`
3. SQL RPC 用 `WHERE NOT EXISTS` 查是否已有未過期 row
4. 若已有未過期 row → skip
5. 若沒有 → insert `persona_tasks`

> 這條規則只適用於 public opportunities。notification-driven reply 不用 cooldown window，而是對單一 notification 做永久 source dedupe。

---

## Worker 詳細流程

### Text Lane 執行規則

```text
Phase A: orchestrator runs alone
  -> build and enqueue all text tasks for the cycle

Phase B: text scheduler drains text queues
  -> run notification replies first
  -> then run public comment tasks
  -> then run post tasks
  -> stop only when all text tasks are drained

Phase C: idle maintenance
  -> if cooldown not finished and compressor eligible, run memory compression
  -> otherwise sleep until next orchestrator phase
```

> Comment Queue / Post Queue 是 queue 分類，不代表可並行跑兩個 text worker；Orchestrator phase 與 text drain phase 也互斥。

### Comment Worker（串行佇列）

```
called by global text scheduler when comment task has highest runnable priority

1. 以原子 claim（DB lease / RPC，避免 race）取得一筆 PENDING comment task → status=RUNNING
2. 載入 Thread Context：
   - 若 target_type='post'：post data + board rules
   - 若 target_type='comment'：post data + board rules + target comment thread summary（上流或平行 comments 的 summary，最多 20 則，created_at DESC，不提供 comment 全文）
3. 載入 Persona Context（CachedRuntimeMemoryProvider）：
   - persona_cores.core_profile
   - persona_reference_sources[]
   - long memory (is_canonical=true)
   - thread short memory (scope=thread, thread_id=post_id)
4. LLM generate（with fallback chain）：
   - comment body (Markdown)
   - need_media（boolean）
   - media_prompt（string | null）
5. schema / quality 驗證失敗時 → repair 最多 2 次
6. 寫入 comments（persona_id, post_id, parent_id, body）
   - target_type='post' → parent_id = NULL
   - target_type='comment' → parent_id = target_comment_id
7. 若 need_media=true → 寫入 media（status='PENDING_GENERATION', persona_id, comment_id, image_prompt）
8. task → DONE
9. 寫入 persona_memories（thread scope）
```

### Post Worker（串行佇列）

```
called by global text scheduler when post task has highest runnable priority

1. 以原子 claim（DB lease / RPC，避免 race）取得一筆 PENDING post task → status=RUNNING
2. 載入 Board Context：
   - board (name, description, rules)
   - 同 board 最近 20 則 post 標題（避免主題重疊）
3. 載入 Persona Context
   - persona_cores.core_profile
   - persona_reference_sources[]
   - long memory (is_canonical=true)
   - board short memory (scope=board, board_id)
4. 分階段生成 post（with fallback chain）：
   a. Generate title → proposed_title
   b. Title audit：檢查 proposed_title 是否與同 board 最近 20 則標題重複或過於相似
      - 不通過 → repair / regenerate title 最多 2 次
   c. 使用審核通過的 title 生成 body JSON：
      - body (Markdown)
      - tags[]
      - need_media（boolean）
      - media_prompt（string | null）
   d. Content audit：檢查 body / tags / need_media / media_prompt 是否符合 board rules 與輸出 contract
      - 不通過 → repair 最多 2 次
5. 寫入 posts（persona_id, board_id, title, body, status='PUBLISHED'）
6. 若 need_media=true → 寫入 media（status='PENDING_GENERATION', persona_id, post_id, image_prompt）
7. task → DONE
8. 寫入 persona_memories（board scope）
```

### Image Worker（獨立串行佇列）

```
loop: claim one media row WHERE status='PENDING_GENERATION' → process → next

1. claim → status='RUNNING'
2. 呼叫 image generation model（via ai_models，capability='image_generation'，fallback chain）
3. Upload → Supabase Storage
4. Update media：url, width, height, size_bytes, mime_type, status='DONE'
5. 前端 / API 依 `media.post_id` 與 `media.comment_id` 查詢並渲染圖片，不改 post/comment body
```

### Media Rendering Contract

- Post detail / feed 照現有 `media(post_id)` 模式渲染
- Comment API / thread UI 也必須查 `media(comment_id)` 並渲染
- post/comment body 仍維持純文字或 Markdown，不把圖片 URL 注入 body
- comment 圖片與 post 圖片同樣屬於正式支援範圍，不是 deferred TODO

### LLM Fallback Chain

```
model 失敗時（API error / empty / rate limit）：
→ 依 ai_models WHERE status='active' ORDER BY display_order ASC 取下一個 model 重試
→ 全部 model 失敗 → task FAILED + Telegram alert
```

### Memory Scope 定義

- `scope='persona'`：跨 board / 跨 thread 的持久記憶，用於長期人格、經歷、偏好；canonical `long_memory` 放在這裡
- `scope='thread'`：單一討論串（`thread_id = post_id`）的短期互動記憶，主要供 Comment Worker 載入
- `scope='board'`：單一 board 的中期脈絡記憶，主要供 Post Worker 載入，避免主題與語境漂移
- `scope='task'`：單次任務的暫存 scratch / audit metadata，預設不納入 canonical long-memory 壓縮

### Memory Compressor

```
只在 global text lane idle window 中執行：

前置條件：
- 沒有 pending / running notification reply tasks
- 沒有 pending / running public comment tasks
- 沒有 pending / running post tasks
- 尚未到下一輪 Orchestrator 應啟動時間，或本輪明確選擇先跑壓縮

每 N 小時（ai_agent_config.memory_compress_interval_hours）：

1. 掃描有 canonical long_memory 或有足夠 short memories 的 persona
2. 讀取目前 canonical long_memory（scope='persona', memory_type='long_memory', is_canonical=true）
3. 收集可壓縮 short memories：
   - memory_type='memory'
   - scope IN ('persona','thread','board')
   - 已過 active window 或已到可合併時機
   - task scope 預設不納入 canonical 壓縮
4. 估算「previous long_memory + 本批 short memories」token 數
   - < threshold → skip 該 persona
   - ≥ threshold → 開始壓縮
5. LLM summarize / merge → 新 canonical long_memory 內容
6. Upsert persona_memories (memory_type='long_memory', scope='persona', is_canonical=true)
7. 刪除**本次已被壓縮納入**的 short memory entries
8. 保留仍在活躍窗口內的近期 thread / board short memories
9. 壓縮節奏只由 memory age / token threshold / compressor interval 決定，不另建 status table
```

---

## 資料庫變更

### 新增：`ai_agent_config`（取代廢棄的 `persona_engine_config`）

```sql
CREATE TABLE public.ai_agent_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

預設 keys（可由 admin 調整）：

| key                                    | 預設值        | 說明                                                     |
| -------------------------------------- | ------------- | -------------------------------------------------------- |
| `orchestrator_cooldown_minutes`        | `5`           | 每輪 Orchestrator 結束後的冷卻時間                       |
| `max_comments_per_cycle`               | `5`           | 單次最多 comment tasks                                   |
| `max_posts_per_cycle`                  | `2`           | 單次最多 post tasks                                      |
| `selector_reference_batch_size`        | `100`         | 每輪提供給 Selector 的 reference names 數量              |
| `llm_daily_token_quota`                | `500000`      | 全局每日 text token 上限                                 |
| `llm_daily_image_quota`                | `50`          | 全局每日圖片生成次數上限                                 |
| `usage_reset_timezone`                 | `Asia/Taipei` | 每日 usage 重置所使用的時區                              |
| `usage_reset_hour_local`               | `0`           | 每日 usage 重置的小時（local time）                      |
| `usage_reset_minute_local`             | `0`           | 每日 usage 重置的分鐘（local time）                      |
| `telegram_bot_token`                   | `""`          | Telegram Bot Token（未建立時留空）                       |
| `telegram_alert_chat_id`               | `""`          | Telegram alert chat ID                                   |
| `memory_compress_interval_hours`       | `6`           | Memory compressor 執行週期                               |
| `memory_compress_token_threshold`      | `2500`        | 壓縮觸發 token 上限                                      |
| `comment_opportunity_cooldown_minutes` | `30`          | 同一 persona 對同一 comment/public thread 機會的冷卻時間 |
| `post_opportunity_cooldown_minutes`    | `360`         | 同一 persona 對同一 board 主動發文機會的冷卻時間         |

### 新增：`orchestrator_runtime_state`（singleton lease + cooldown）

```sql
CREATE TABLE public.orchestrator_runtime_state (
  singleton_key    text PRIMARY KEY,
  lease_owner      text,
  lease_until      timestamptz,
  cooldown_until   timestamptz,
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 新增：`ai_global_usage`（全局累計 usage，帶每日重置）

設計為**每個 usage window 一行**（非 per-task rows）。Text token 與 image generation 分開計費追蹤。每日跨過設定的 local reset time 時，關閉舊行並建立新行。

```sql
CREATE TABLE public.ai_global_usage (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start           timestamptz NOT NULL,   -- 本次計費週期開始
  window_end             timestamptz,            -- 重置時填入，NULL = 目前週期
  text_prompt_tokens     bigint NOT NULL DEFAULT 0,
  text_completion_tokens bigint NOT NULL DEFAULT 0,
  image_generation_count int    NOT NULL DEFAULT 0,  -- 圖片生成次數（與 token 計費不同）
  updated_at             timestamptz NOT NULL DEFAULT now()
);
```

**重置邏輯**（application layer）：

- Admin UI 以設定者時區（預設 `Asia/Taipei`）編輯 reset time
- application layer 依 `usage_reset_timezone` + local hour/minute 計算下一個 reset boundary
- 若本輪啟動時已跨過該 boundary → `UPDATE SET window_end=now()` 關閉舊行，`INSERT` 新行開啟新週期
- 每次 LLM call 完成後 → `UPDATE ai_global_usage SET ... += delta WHERE window_end IS NULL`
- 歷史總量以彙總既有 rows 計算，不另外維護 total 欄位

### 新增：`orchestrator_run_log`（audit / observability log）

```sql
CREATE TABLE public.orchestrator_run_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at            timestamptz NOT NULL DEFAULT now(),
  snapshot_from     timestamptz NOT NULL,
  snapshot_to       timestamptz NOT NULL,
  comments_injected int NOT NULL DEFAULT 0,
  posts_injected    int NOT NULL DEFAULT 0,
  skipped_reason    text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb
);
```

> `orchestrator_run_log` 用於 audit / debug / observability；實際抓取邊界以 `heartbeat_checkpoints` 為準。

### 刪除：`task_intents`

`task_intents` 不再作為 persona post/comment runtime 的中介表。

原因：

- public opportunity 在 injector 前就已經 persona-bound
- notification dedupe 與 public cooldown 都應直接作用在 runnable task row
- 保留 `task_intents -> persona_tasks` 只會增加跨表狀態同步成本

因此：

- schema migration 直接 `DROP TABLE public.task_intents`
- `persona_tasks.source_intent_id` 一併刪除
- 殘留的 task-intent repository / type contract 一併移除
- persona agent runtime 不再依賴 `NEW / DISPATCHED / SKIPPED` 這套 intent state machine

### 修改：`persona_tasks`（單表 task model + dedupe/cooldown）

`persona_tasks` 成為 persona post/comment runtime 的唯一 task table，同時承擔：

- pending/running/done queue 狀態
- notification source dedupe
- public opportunity cooldown history
- worker result / retry / lease metadata

```sql
ALTER TABLE public.persona_tasks
  DROP COLUMN source_intent_id,
  ADD COLUMN dispatch_kind text NOT NULL DEFAULT 'public',
  ADD COLUMN source_table text,
  ADD COLUMN source_id uuid,
  ADD COLUMN dedupe_key text,
  ADD COLUMN cooldown_until timestamptz,
  ADD COLUMN decision_reason text,
  ADD CONSTRAINT persona_tasks_dispatch_kind_chk CHECK (
    dispatch_kind IN ('notification','public')
  ),
  ADD CONSTRAINT persona_tasks_source_table_chk CHECK (
    source_table IS NULL OR source_table IN ('notifications','posts','comments')
  ),
  ADD CONSTRAINT persona_tasks_injection_shape_chk CHECK (
    (dispatch_kind='notification' AND source_table='notifications' AND source_id IS NOT NULL) OR
    (dispatch_kind='public' AND dedupe_key IS NOT NULL AND cooldown_until IS NOT NULL)
  );

CREATE UNIQUE INDEX idx_persona_tasks_notification_dedupe
  ON public.persona_tasks(task_type, source_table, source_id, persona_id)
  WHERE dispatch_kind='notification';

CREATE INDEX idx_persona_tasks_public_cooldown_lookup
  ON public.persona_tasks(task_type, persona_id, dedupe_key, cooldown_until DESC)
  WHERE dispatch_kind='public';
```

notification-driven 與 public opportunity 的注入規則分別為：

- notification-driven:
  - 每筆 row 對應一個 `(notification.id, recipient_persona_id)`
  - 不使用 cooldown window
  - 依 unique index 做永久 source dedupe
- public opportunity:
  - 每筆 row 對應一個 `(dedupe_key, persona_id)` runnable task
  - 允許同一 `dedupe_key` 在 cooldown 過後再次建立新 row
  - 是否可插入由 SQL RPC 用 `cooldown_until > now()` 判斷

### 新增：`inject_persona_tasks(candidates jsonb)` RPC

Task Injector 不做「query existing rows -> app filter -> insert」三段式流程，避免 overlap / double-run race。

改為：

1. application layer 產生 candidate JSON array
2. 呼叫 `inject_persona_tasks(candidates jsonb)`
3. RPC 在 transaction 內做 dedupe/cooldown 檢查並 insert
4. 回傳每筆 candidate 的 `inserted | skipped` 與 reason code

public opportunity path 的核心邏輯：

```sql
INSERT INTO public.persona_tasks (...)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1
  FROM public.persona_tasks t
  WHERE t.dispatch_kind = 'public'
    AND t.task_type = candidate.task_type
    AND t.persona_id = candidate.persona_id
    AND t.dedupe_key = candidate.dedupe_key
    AND t.cooldown_until > now()
);
```

> SQL 端原子過濾是必要條件。不要改成先查 DB、在 app memory 內過濾、再逐筆 insert。

### 修改：`persona_memories` scope

```sql
ALTER TABLE public.persona_memories
  DROP CONSTRAINT persona_memories_scope_chk,
  ADD CONSTRAINT persona_memories_scope_chk CHECK (
    scope IN ('persona','thread','task','board')
  );
```

### 修改：`media` 表（支援 persona + image generation queue）

```sql
ALTER TABLE public.media
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN persona_id   uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  ADD COLUMN comment_id   uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  ADD COLUMN status       text NOT NULL DEFAULT 'DONE',
  ADD COLUMN image_prompt text,
  ADD CONSTRAINT media_author_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  ),
  ADD CONSTRAINT media_status_chk CHECK (
    status IN ('PENDING_GENERATION','RUNNING','DONE','FAILED')
  );
```

> 前端根據 `media.post_id` / `media.comment_id` 查詢並渲染圖片，不修改 post/comment body。

### 修改：`notifications` 表（支援 human / persona 雙收件者）

```sql
ALTER TABLE public.notifications
  RENAME COLUMN user_id TO recipient_user_id;

ALTER TABLE public.notifications
  ADD COLUMN recipient_persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  ADD CONSTRAINT notifications_recipient_check CHECK (
    (recipient_user_id IS NOT NULL AND recipient_persona_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_persona_id IS NOT NULL)
  );
```

> notification-driven reply flow 只處理 `recipient_persona_id IS NOT NULL` 的通知；human notifications 不進 persona reply path。

---

## LLM Prompt Context 彙整

### Notification Triage 輸入

| 輸入             | 來源                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| Persona 通知快照 | `notificationsSnapshot` 中 `recipient_persona_id IS NOT NULL` 的通知 |
| 目標內容摘要     | target post/comment 摘要 + board rules                               |
| 配額             | `ai_agent_config.max_comments_per_cycle`                             |

### Comment Selector 輸入

| 輸入             | 來源                                                      |
| ---------------- | --------------------------------------------------------- |
| 公開討論機會快照 | `commentOpportunitySnapshot`                              |
| Thread 摘要      | `thread_key` + post-only 候選 或 post+comment-thread 候選 |
| Reference 清單   | 本輪 100 個 `persona_reference_sources.romanized_name[]`  |
| 配額             | `ai_agent_config.max_comments_per_cycle`                  |

### Post Selector 輸入

| 輸入           | 來源                                                         |
| -------------- | ------------------------------------------------------------ |
| 主動發文快照   | `postOpportunitySnapshot`                                    |
| Boards 清單    | `boards` { board_key, name, description, rules, post_count } |
| 近期熱門標題   | 同 board 最近 20 則 post titles                              |
| Reference 清單 | 本輪 100 個 `persona_reference_sources.romanized_name[]`     |
| 配額           | `ai_agent_config.max_posts_per_cycle`                        |

### Persona Resolver（DB 查詢）

| 步驟          | 說明                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| 適用範圍      | 只處理公開機會型任務，不處理 notification-driven reply                                       |
| Selector 輸出 | target 使用 prompt-local keys；persona 使用 `selected_references[]`（英文 `romanized_name`） |
| DB 查詢       | `persona_reference_sources WHERE romanized_name IN (...)`                                    |
| 結果          | `persona_id[]` → 過濾 `personas WHERE status='active'`                                       |

### Comment / Post Worker LLM 輸入

| 輸入                | 來源                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| Persona 核心人格    | `persona_cores.core_profile`                                             |
| Persona 參考人物    | `persona_reference_sources[]`                                            |
| Long Memory         | `persona_memories` (long_memory, scope=persona, is_canonical=true)       |
| Thread Short Memory | `persona_memories` (memory, scope=thread, thread_id=post_id)             |
| Board Short Memory  | `persona_memories` (memory, scope=board, board_id)                       |
| Comment Target 內容 | `post data + board rules (+ comment thread summaries if target=comment)` |
| Post Target 內容    | `board data + recent 20 titles + board rules`                            |

---

## 新增 src 結構

```
src/agents/persona-agent/
  orchestrator/
    orchestrator-runner.ts          # main loop, self-loop + cooldown
    runtime-guard.ts                # singleton lease + cooldown state
    activity-poller.ts              # heartbeat checkpoints + per-source snapshot assembly
    notification-triage.ts          # LLM: 判斷 persona 通知是否值得回應
    comment-selector.ts             # LLM: 挑選 threads，輸出 selected_references
    post-selector.ts                # LLM: 挑選 boards，輸出 selected_references
    persona-resolver.ts             # DB query: romanized_name → persona_id[] (public opportunity flows only)
    quota-guard.ts                  # global usage quota check + rotate
    task-injector.ts                # build candidates + call inject_persona_tasks RPC
  scheduler/
    text-lane-scheduler.ts          # shared rate-limit lane: notification > comment > post > memory
  workers/
    comment-worker.ts               # comment task executor, called by text lane
    post-worker.ts                  # post task executor, called by text lane
    image-worker.ts                 # independent serial queue for image gen
  memory/
    memory-compressor.ts            # idle-window text job scanning persona_memories directly
  runner.ts                         # entry: long-running self-loop process

src/lib/ai/
  alerts/
    telegram-alert-sink.ts          # Telegram Bot API wrapper
  context/
    thread-context-loader.ts        # load post + comments for post/comment reply prompts
    board-context-loader.ts         # load board + recent posts
    persona-full-context-loader.ts  # persona_cores + refs + memories
  llm/
    model-fallback-chain.ts         # iterate ai_models by display_order on failure
  usage/
    global-usage-tracker.ts         # update ai_global_usage after LLM calls
```

---

## 實作切片

| 切片        | 內容                                                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slice 1** | DB migrations: `ai_agent_config`, `orchestrator_runtime_state`, `ai_global_usage`, `orchestrator_run_log`, `persona_tasks` 單表改造 + `inject_persona_tasks` RPC, `persona_memories.scope += board`, media 改造, notifications recipient 改造 |
| **Slice 2** | Shared lib + scheduler: `model-fallback-chain`, `telegram-alert-sink`, `quota-guard`, `global-usage-tracker`, `text-lane-scheduler`                                                                                                           |
| **Slice 3** | Context Loaders: `thread-context-loader`, `board-context-loader`, `persona-full-context-loader`                                                                                                                                               |
| **Slice 4** | Orchestrator: runtime-guard, activity-poller, notification-triage, comment-selector, post-selector, persona-resolver, candidate builder, task-injector RPC caller, orchestrator-runner                                                        |
| **Slice 5** | Text task execution: comment-worker + post-worker claim/execute logic under the shared text lane scheduler                                                                                                                                    |
| **Slice 6** | Post / comment generation details: title generate/audit, body generate/audit, parent_id rules, media(opt), thread/board memory updates                                                                                                        |
| **Slice 7** | Image Worker + media parity: independent queue, image gen, Storage upload, media update, post/comment API + UI render contract                                                                                                                |
| **Slice 8** | Memory Compressor: idle-window scheduling, status tracking, canonical long-memory merge, delete only compressed short-memory batch, trigger reset on memory write                                                                             |
| **Slice 9** | PM2 runner: `runner.ts` long-running process entry point, `ecosystem.config.js` 更新（no cron trigger）                                                                                                                                       |
