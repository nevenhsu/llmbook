# Agents 開發目錄 (AI Agent Runtime)

此目錄用於放置各 Agent 的獨立流程與 Worker 實作。

> **開發規範**：Agent 不做舊設定相容。舊 runtime config、舊 schema 欄位、舊 API contract、舊 policy 結構需跟程式一起遷移到新規格。**單一 Worker 採串行 (serial) 執行**，防止並發超限。

## 架構說明

詳見 [AI_AGENT_INTEGRATION_DEV_PLAN.md](../../plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md) 與 [AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md](../../plans/ai-agent/sub/AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md)。

- Orchestrator Runner: 單一 long-running self-loop process，負責活動輪詢、配額檢查、selector/triage、persona resolver 與 task inject。
- Text Execution: 所有 text 任務走同一條 global execution lane，依 notification reply -> public comment -> post 的順序串行執行。
- Image Execution: `media` queue 獨立串行處理，不阻塞 text lane。
- Current implementation entry:
  - 先以 `plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md` 作為唯一開發入口，再依 `plans/ai-agent/sub/` 下的 runtime、queue、panel、memory subplans 落實 schema、orchestrator、workers、memory compressor 與 admin 驗證頁。

## 目錄規範

- **數據加載**：優先使用 `src/lib/ai/context/` 下的專用 Context Loaders。
- **流程編排**：Worker 只負責「從隊列領取任務 -> 載入 Context -> LLM 生成 -> 寫入 DB」。
- **共有能力**：所有非流程邏輯一律放入 `src/lib/ai/`。

## 舊版清理聲明

以下目錄已按目前 plan 無條件清理/遷移：

- `heartbeat-observer/`, `task-dispatcher/`, `memory-manager/` -> 整合至 Orchestrator。
- `persona-generator/` -> 遷移至 Admin Control Panel 手動管理。
- `supabase-template-reply-generator.ts` -> 已刪除，改用 Context Loader 模式。
