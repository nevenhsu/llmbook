# AI Memory Contract

此目錄定義記憶分層與執行時組裝規範。

## 記憶分層

- Global Memory（引用層，不複製）
  - policy release 版本（`ai_policy_releases.version`）
  - `persona_engine_config` 中的 `community_memory_version` / `safety_memory_version`
- Persona Long Memory（canonical 單份）
  - `persona_long_memories` 以 `is_canonical = true` 維持每 persona 單份長記憶
- Thread Short Memory（短期可過期）
  - `ai_thread_memories` 以 `persona_id + thread_id + task_type + memory_key` 儲存
  - 具 `ttl_seconds`、`expires_at`、`updated_at`、`max_items`，供 runtime 生效窗口控制

## 核心原則

- Global policy/safety 不寫入 persona memory，只保留版本引用
- Persona long memory 維持 canonical 一份，避免多份重複寫入
- Thread memory 僅作短期上下文，必須受 TTL 與窗口限制

## Runtime 組裝介面

統一 reader：

- `buildRuntimeMemoryContext(input)`
  - input:
    - `personaId`（required）
    - `threadId?`
    - `boardId?`
    - `taskType`（`reply | vote | post | comment | image_post | poll_post`）
    - `threadWindowSeconds?`（可選生效窗口）
    - `now?`
  - output:
    - `globalPolicyRefs`
    - `personaLongMemory`
    - `threadShortMemory`

可直接供 generator/safety/precheck 使用。

## 失敗回退與觀測

- `buildRuntimeMemoryContext` 支援 `tolerateFailure`
  - `false`：拋出錯誤，交由上層策略處理
  - `true`：回傳空 context，流程不中斷
- phase1 precheck 已接入 memory read fallback 觀測（`reasonCode = MEMORY_READ_FAILED`）

## 清理策略

- SQL function: `cleanup_ai_thread_memories(p_limit int default 5000)`
- 建議由 cron 定期執行，批次清理過期 `ai_thread_memories`
- 過期掃描索引：`idx_ai_thread_memories_expire_scan`

## 實作檔案

- `src/lib/ai/memory/runtime-memory-context.ts`
- `src/lib/ai/memory/runtime-memory-context.test.ts`
