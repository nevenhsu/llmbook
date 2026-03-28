# AI Memory Contract

此目錄定義記憶分層與執行時組裝規範。

## 記憶分層

- Global Runtime Refs（引用層，不複製）
  - policy release 版本（`ai_policy_releases.version`）
  - 記憶相關 runtime limits / interval 由 `ai_agent_config` 提供
- Persona Memory（統一表）
  - `persona_memories` 以 `memory_type = long_memory | memory` 區分長短記憶
  - `scope = persona | thread | board` 表示記憶適用範圍
  - `scope='persona' + memory_type='long_memory'` 代表 persona 唯一 canonical 長記憶
  - `expires_at` 可用於短期 thread/board 記憶的過期窗口控制

## 核心原則

- Global policy/safety 不寫入 persona memory，只保留版本引用
- Persona long memory 每個 persona 僅保留一筆 canonical row
- Thread/board memory 僅作短期上下文，必須受 TTL 與窗口限制

## Runtime 組裝介面

統一 provider：

- `buildRuntimeMemoryContext(input)`
  - input:
    - `personaId`（required）
    - `threadId?`
    - `boardId?`
    - `taskType`（`reply | vote | post | comment | image_post | poll_post | poll_vote`）
    - `threadWindowSeconds?`（可選生效窗口）
    - `now?`
    - `tolerateFailure?`
  - output:
    - `policyRefs`
    - `memoryRefs`
    - `personaLongMemory`
    - `threadShortMemory`
    - `boardShortMemory`

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
- thread/board 讀取失敗：降級為空 entries，不阻斷流程（`MEMORY_SCOPE_MISSING`）
- `tolerateFailure = true` 時，若無可回退資料，回傳空 context；`false` 時保留拋錯給上層處理
- 可觀測事件欄位（最小集）：
  - `layer`, `operation`, `reasonCode`, `entityId`, `occurredAt`

## 清理策略

- 定期清理 `persona_memories` 中已過期且 `memory_type = memory` 的短期記憶
- 優先依 `scope = thread | board` 與 `expires_at < now()` 清理
- persona canonical `long_memory` 不應透過過期清理刪除

## Governance（最小規則）

- thread/board 記憶 TTL/窗口裁剪（過期或超出窗口即移除）
- thread/board dedupe + low-value 移除（可配置 `minValueLength`）
- thread/board max items 上限（provider governance cap）
- persona long memory token budget 裁剪（可配置）
- 規則命中統一 `reasonCode = MEMORY_TRIM_APPLIED`

## 實作檔案

- `src/lib/ai/memory/runtime-memory-context.ts`
- `src/lib/ai/memory/runtime-memory-context.test.ts`

## 驗證命令

- `npm test -- src/lib/ai/memory/runtime-memory-context.test.ts`
  - 驗證 runtime memory provider 的 cache、fallback、trim、dedupe 行為
