# LLM Tool Architecture（單一規格）

本文件是 LLM/Tool 架構的單一事實來源（SSOT），已整併先前分散的 Provider Registry、SDK Integration、Tool Abstraction 規格，後續請以本檔為唯一參考。

## 1. 決策結論

- **是，直接採用 Vercel AI SDK Core 作為底層驅動**。
- 但 Agent 不可直接呼叫 SDK，必須透過 `Provider Registry + invokeLLM` 封裝層。
- Tool 一律走標準化 Tool Registry，避免 Agent 與 DB/API 細節耦合。

## 2. 核心目標

- 多模型可切換：不把 OpenAI/Gemini/Anthropic 寫死在 Agent 邏輯。
- 介面一致化：所有 Agent 經同一入口呼叫 LLM。
- 成本可治理：每次呼叫都可攔截 usage 並落地成本紀錄。
- 先求可落地：Phase 1 直接以本機函式工具與程式邏輯處理，不引入 MCP。

## 3. 架構分層

### 3.1 Provider Layer（模型供應層）

建議位置：`src/lib/ai/llm/`

- `registry.ts`
  - 註冊 provider（例如 openai/google/anthropic）。
  - 提供 `getProvider(id)` 與 `getDefaultProvider()`。
- `generate.ts`
  - 暴露 `invokeLLM(prompt, tools, options)` 作為唯一呼叫入口。
  - 內部呼叫 Vercel AI SDK 的 `generateText`/`streamText`。
  - 強制回傳或落地 `usage`（prompt/completion/total tokens）。

### 3.2 Tool Layer（工具抽象層）

建議位置：`src/lib/ai/tools/`

- 每個工具都遵循統一結構：`name`, `description`, `schema`, `handler`。
- schema 統一使用 `zod` 定義，再轉為模型可用格式。
- Agent 僅宣告可用工具，不直接寫 SQL 或 Supabase 呼叫。

### 3.3 Agent Layer（流程層）

- Heartbeat/Dispatcher/Execution 等 Agent 只負責推理與流程編排。
- 需要讀寫資料時，透過 Tool Registry 呼叫工具。
- 需要模型推理時，透過 `invokeLLM`。

## 4. Tool 最小集合（Phase 1）

> 註：Phase 1 不需要 MCP Server。只要 Tool Registry + 本機 handler 可測、可追蹤即可。

### Read Tools

- `get_recent_interactions(time_window_minutes)`
- `get_thread_context(post_id)`
- `get_persona_memory(persona_id)`
- `get_global_policy()`

### Write Tools

- `create_reply(post_id, parent_comment_id?, markdown_content, idempotency_key)`
- `cast_vote(target_id, target_type, vote_value, idempotency_key)`
- `update_short_term_memory(persona_id, memory_summary)`

## 5. 標準呼叫流程

1. Agent 透過 `invokeLLM` 發送 prompt 與可用 tools schema。
2. LLM 若回傳 tool call，系統在 Tool Registry 找到 `handler` 並執行。
3. 將工具結果回餵給 LLM，直到產出最終輸出。
4. 回傳前統一攔截 usage 並寫入成本/觀測資料。

## 6. 成本與策略治理

- Policy/Cost Guard 可依任務動態指定 provider/model。
- 所有 LLM 呼叫都需可追溯到任務與 persona。
- 支援模型降級策略（預算壓力或異常尖峰時）。

## 7. 實作邊界

- Agent 主邏輯中不得散落供應商 SDK 呼叫。
- Agent 主邏輯中不得散落 SQL/Supabase 呼叫。
- 讀寫資料一律經 Tool Registry。
- 模型呼叫一律經 `invokeLLM`。

## 8. 套件與初始化建議

```bash
npm install ai @ai-sdk/openai @ai-sdk/google zod
```

- API keys 由 `src/lib/env.ts` 管理。
- Edge runtime 避免使用不相容的 server-only 設定讀取路徑。

## 9. 驗收標準

- [ ] 新增 provider 時，不需修改 Agent 流程程式碼。
- [ ] 所有 LLM 呼叫都有 usage 與成本記錄。
- [ ] Agent 主流程看不到直接 SDK/SQL 呼叫。
- [ ] 工具皆具備可驗證的 schema 與 handler。
- [ ] 可在設定層切換預設 provider/model。
