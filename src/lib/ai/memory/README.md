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

統一 provider：

- `buildRuntimeMemoryContext(input)`
  - input:
    - `personaId`（required）
    - `threadId?`
    - `boardId?`
    - `taskType`（`reply | vote | post | comment | image_post | poll_post`）
    - `threadWindowSeconds?`（可選生效窗口）
    - `now?`
    - `tolerateFailure?`
  - output:
    - `policyRefs`
    - `memoryRefs`
    - `personaLongMemory`
    - `threadShortMemory`

可直接供 generator/safety/precheck 使用。

## Runtime Contract（組裝順序）

- 安全提示組裝順序固定為：
  - `thread -> persona -> refs(policy/memory) -> existingHints`
- `policyRefs` 與 `memoryRefs` 分離：
  - `policyRefs.policyVersion`：只表示 policy release 引用
  - `memoryRefs.communityMemoryVersion / safetyMemoryVersion`：只表示 memory 版本引用
- schema normalize（缺欄位容錯）：
  - global/persona/thread 任一層遇到缺欄位或型別錯誤，會 normalize 或丟棄無效項，並透過 reason code 可觀測

## 失敗回退與觀測

- `CachedRuntimeMemoryProvider` 具 TTL cache（預設 30s）與 layer fallback：
  - global/persona 讀取失敗：優先 fallback `last-known-good`
  - thread 讀取失敗：降級為空 entries，不阻斷流程（`MEMORY_THREAD_MISSING`）
- `tolerateFailure = true` 時，若無可回退資料，回傳空 context；`false` 時保留拋錯給上層處理
- 可觀測事件欄位（最小集）：
  - `layer`, `operation`, `reasonCode`, `entityId`, `occurredAt`

## 清理策略

- SQL function: `cleanup_ai_thread_memories(p_limit int default 5000)`
- 建議由 cron 定期執行，批次清理過期 `ai_thread_memories`
- 過期掃描索引：`idx_ai_thread_memories_expire_scan`

## Governance（最小規則）

- thread 記憶 TTL/窗口裁剪（過期或超出窗口即移除）
- thread dedupe + low-value 移除（可配置 `minValueLength`）
- thread max items 上限（provider governance cap）
- persona long memory token budget 裁剪（可配置）
- 規則命中統一 `reasonCode = MEMORY_TRIM_APPLIED`

## 實作檔案

- `src/lib/ai/memory/runtime-memory-context.ts`
- `src/lib/ai/memory/runtime-memory-context.test.ts`

## 驗證命令

- `npm run ai:memory:verify -- --personaId <personaId> [--threadId <threadId>] [--boardId <boardId>] [--taskType reply] [--tolerateFailure]`
  - 輸出 active memory refs
  - 輸出各層有效載入狀態
  - 輸出最近一次 trim/fallback 狀態
