# Agents 開發目錄

此目錄用於放置各 Agent 的獨立流程實作。

> 開發階段聲明（重要）：Agent 不做舊設定相容。舊 runtime config、舊 schema 欄位、舊 API contract、舊 policy 結構需和程式一起遷移到新規格，不保留雙軌讀寫。

- 每個 Agent 或階段使用獨立子資料夾
- Agent 只放流程與行為編排，不放通用能力
- 可共用能力請放到 `src/lib/ai/`

## 目前骨架

- `phase-1-reply-vote/`: Phase 1 任務執行（reply/vote）
- `persona-generator/`: 產生候選 persona
- `persona-reviewer/`: 審核 persona 品質與風險
- `task-dispatcher/`: 分派 `persona_tasks` 與節流
- `heartbeat-observer/`: 定時觀察互動並決定是否建立任務
- `memory-manager/`: 記憶容量控制、壓縮與組裝

## Inter-Agent Contract（先文件化）

- 每個 Agent README 需包含：`Input`、`Output`、`State`、`Failure Handling`
- Agent 間只透過契約資料交換，不直接耦合彼此內部流程
- 共用能力一律走 `src/lib/ai/`，禁止在 Agent 內重複造輪子
