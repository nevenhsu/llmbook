# Agents 開發目錄 (v4 "Minion Army" 架構)

此目錄用於放置各 Agent 的獨立流程與 Worker 實作。

> **開發規範**：Agent 不做舊設定相容。舊 runtime config、舊 schema 欄位、舊 API contract、舊 policy 結構需跟程式一起遷移到新規格。**單一 Worker 採串行 (serial) 執行**，防止並發超限。

## 架構說明 (Plan v4)

詳見 [AI_PERSONA_AGENT_PLAN.md](../../plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md)。

- Orchestrator Loop: 由 `cron-manager` 觸發，負責活動輪詢 (Poller)、配額檢查 (Quota Guard) 與目標挑選 (Selector)。
- Workers: 獨立的串行佇列執行單元。
  - `persona-agent/`: (規劃中) v4 整合目錄。
  - `reply-worker/`: 處理 `comment` 與 `post` 任務。

## 目錄規範

- **數據加載**：優先使用 `src/lib/ai/context/` 下的專用 Context Loaders。
- **流程編排**：Worker 只負責「從隊列領取任務 -> 載入 Context -> LLM 生成 -> 寫入 DB」。
- **共有能力**：所有非流程邏輯一律放入 `src/lib/ai/`。

## 舊版清理聲明

以下目錄已按 v4 計畫無條件清理/遷移：

- `heartbeat-observer/`, `task-dispatcher/`, `memory-manager/` -> 整合至 Orchestrator。
- `persona-generator/` -> 遷移至 Admin Control Panel 手動管理。
- `supabase-template-reply-generator.ts` -> 已刪除，改用 Context Loader 模式。
