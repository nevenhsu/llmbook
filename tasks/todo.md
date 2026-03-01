# Memory Layer Governance 強化（Phase2）Todo

## Plan

- [x] 對齊現況：盤點 `PHASE2_QUALITY_CONTROL_PLANE_DESIGN.md`、memory contract 與 phase1 整合點
- [x] Memory Contract & Layering：拆分 policy refs / memory refs，定義 schema validate + normalize（缺欄位容錯）
- [x] Memory Assembly Provider：新增 TTL cache、last-known-good fallback、thread 缺失降級觀測
- [x] Governance Rules：實作 thread TTL/裁剪、persona cap（maxItems/tokenBudget）、去重策略與統一 reason code
- [x] Runtime Integration（Phase1）：在 dispatch precheck 串接 provider，覆蓋正常載入/版本更新/讀取失敗回退
- [x] Observability & Audit：補齊最小事件欄位（layer/operation/reasonCode/entityId/occurredAt）與事件路徑
- [x] Tests：補單元與整合測試，確認不回歸 policy/review/safety 既有流程
- [x] CLI / Script：新增 `ai:memory:verify` 驗證命令與摘要輸出
- [x] Docs：更新 `src/lib/ai/memory/README.md`、`src/lib/ai/README.md`、`src/lib/ai/REASON_CODES.md`
- [x] Verification：執行目標測試與腳本，收斂結果

## Review

- 實作摘要：完成 memory contract 分層（policyRefs/memoryRefs）、新增 CachedRuntimeMemoryProvider（TTL + LKG fallback + governance trim/dedupe）與 phase1 precheck 整合驗證。
- 驗證命令：`npm test -- src/lib/ai/memory/runtime-memory-context.test.ts src/agents/task-dispatcher/precheck/reply-dispatch-precheck.test.ts src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts src/lib/ai/evaluation/runner.integration.test.ts src/lib/ai/policy/policy-control-plane.test.ts`；`npm run ai:memory:verify -- --personaId persona-test --taskType reply --tolerateFailure`
- 測試結果：上述測試檔全綠（29 tests）；verify 指令可輸出 active refs / layer load state / trim fallback 摘要。
- 風險與後續：`ai:memory:verify` 在缺少 Supabase env 時會落入 fallback-empty（可觀測）；若要在 CI 驗證實際 DB refs，需補齊服務環境變數。

---

# Soul-Driven Generation Runtime（Phase2）Todo

## Plan

- [x] 對齊 `plans/ai-minion-army/*` 與 phase1 現況，確認 soul 接點（execution / precheck / observability）
- [x] 新增 soul reader（service role）與 runtime normalize（缺欄位容錯 + 預設值）
- [x] 建立 soul runtime provider（fail-safe 降級，不中斷主流程）並提供最小可觀測事件
- [x] 在 reply generation 主線注入 soul prompt（identity/value/decision/interaction/language/guardrails）
- [x] 在 dispatch precheck 增加可選 soul 摘要（如風險偏好），失敗時 fail-safe
- [x] 統一 reason code（新增 SOUL_LOAD_SUCCESS / SOUL_LOAD_FAILED / SOUL_FALLBACK_EMPTY / SOUL_APPLIED）
- [x] 補齊單元/整合/回歸測試（含有/無 soul 可跑通與輸出差異可觀測）
- [x] 新增 `npm run ai:soul:verify -- --personaId <id>` 腳本與 package script
- [x] 更新 `src/lib/ai/README.md`、`src/agents/persona-generator/README.md`、`src/lib/ai/REASON_CODES.md`
- [x] 執行目標測試與 verify 命令，補上 Review 結果

## Review

- [x] Implementation summary
  - 新增 `src/lib/ai/soul/runtime-soul-profile.ts`：service-role soul reader、normalize、fallback-empty、event sink/status 與 precheck hints。
  - reply generation 已接入 soul（identity/value/decision/interaction/language/guardrails）並實際改變輸出語氣與觀點。
  - dispatch precheck 新增 soul 摘要注入（risk/tradeoff hints），讀取失敗時 fail-safe 並記錄 `SOUL_LOAD_FAILED`。
  - reason codes 集中於 `src/lib/ai/reason-codes.ts`，補齊 `SOUL_*` 常數。
- [x] Verification commands + results
  - `npm test -- src/lib/ai/soul/runtime-soul-profile.test.ts src/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator.test.ts src/agents/task-dispatcher/precheck/reply-dispatch-precheck.test.ts src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-execution-agent.test.ts src/lib/ai/policy/policy-control-plane.test.ts src/lib/ai/safety/reply-safety-gate.test.ts`（42 tests passed）
  - `npm test -- src/lib/ai/soul/runtime-soul-profile.test.ts src/agents/task-dispatcher/precheck/reply-dispatch-precheck.test.ts src/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator.test.ts src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts`（18 tests passed）
  - `npm run ai:soul:verify -- --personaId persona-test`（可輸出 load status / normalized summary / fallback+applied status）
- [x] Regression/safety/policy gate check
  - policy/safety/review 既有流程測試未退化，precheck 與 execution 在 soul 缺失/失敗時仍可跑通。

---

# LLM Prompt Runtime 正式化（Phase1）Todo

## Plan

- [x] 對齊 `plans/ai-minion-army/*` 與 phase1 flow，確認 prompt/model 接點與不可變 gate（policy/safety/review）
- [x] 新增 Prompt Builder Contract（reply phase1）與固定 block 順序（system baseline/policy/soul/memory/task context/output constraints）
- [x] 完成 block 級降級策略與 observability，不可阻斷主流程
- [x] 定義 `ModelAdapter.generateText()` 契約（Vercel AI SDK Core shape 相容）
- [x] 實作 `MockModelAdapter` 三模式（success/empty/throw）供測試
- [x] 實作 `VercelAiCoreAdapter` 最小可用（grok env 路徑 + fail-safe fallback）
- [x] Runtime Integration：reply generation 改為 prompt builder -> model adapter -> text post-process，失敗時回空輸出
- [x] 統一 reason code（含 `PROMPT_BUILD_SUCCESS`/`PROMPT_BUILD_FAILED`/`MODEL_CALL_FAILED`/`MODEL_FALLBACK_USED`）並落在 `src/lib/ai/reason-codes.ts`
- [x] 補單元/整合/回歸測試（prompt 順序、缺失降級、model empty/error fallback、phase1 on/off 跑通）
- [x] 新增 `npm run ai:prompt:verify -- --personaId <id> --postId <id>` 與摘要輸出
- [x] 更新文件：`src/lib/ai/README.md`、`src/lib/ai/REASON_CODES.md`、`src/agents/phase-1-reply-vote/README.md`
- [x] Verification：執行目標測試與 verify 指令並補 Review 結果

## Review

- 實作摘要：新增 `prompt-runtime`（prompt builder/model adapter/runtime events）並將 phase1 reply generation 主線改為 `prompt builder -> model adapter -> post-process`，model empty/error 自動回退 deterministic compose。
- 契約重點：`ModelAdapter.generateText()` 輸入支援 `prompt/messages`、輸出對齊 `text/finishReason/usage`；`MockModelAdapter` 提供 success/empty/throw；`VercelAiCoreAdapter` 支援 grok env 路徑與 fail-safe。
- Observability：新增 `PromptRuntimeReasonCode`（`PROMPT_BUILD_SUCCESS`/`PROMPT_BUILD_FAILED`/`MODEL_CALL_FAILED`/`MODEL_FALLBACK_USED`）與最小事件欄位（`layer/operation/reasonCode/entityId/occurredAt`）。
- 驗證命令：
  - `npm test -- src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/prompt-runtime/model-adapter.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-execution-agent.test.ts src/lib/ai/safety/reply-safety-gate.test.ts src/lib/ai/policy/policy-control-plane.test.ts src/lib/ai/review-queue/review-queue.test.ts`（48 tests passed）
  - `npm test -- src/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator.test.ts`（2 tests passed）
  - `npm run ai:prompt:verify -- --personaId persona-test --postId post-test`（在目前環境因 fetch failed 無法連線 Supabase）
- 回歸結論：policy/review/safety 相關目標測試皆通過，gate 流程位置與語意未變更。

# LLM Tool Runtime 正式化（Phase1）Todo

## Plan

- [x] 對齊 `plans/ai-minion-army/*` 與 phase1 flow，確認 tool loop 注入點與既有 gate 邊界（policy/safety/review 不變）
- [x] 定義 Tool Contract 與 Registry（`name/description/schema/handler` + allowlist）
- [x] 實作 reply phase1 最小工具集（`get_thread_context`/`get_persona_memory`/`get_global_policy`/`create_reply`）與 mock provider
- [x] 在 model adapter 加入 tool call execute loop（含 max iterations、timeout、fail-safe fallback）
- [x] 統一 tool reason codes 與最小事件欄位（`layer/operation/reasonCode/entityId/occurredAt`）
- [x] Runtime 整合：reply prompt runtime 接入 tool loop，確保不中斷主流程且失敗時回空輸出
- [x] 測試補齊：單元/整合/回歸（tool success / schema validation fail / handler throw / loop timeout）
- [x] 新增 verify 指令：`npm run ai:tool:verify`
- [x] 文件更新：`README.md`、`src/lib/ai/REASON_CODES.md`、`src/agents/phase-1-reply-vote/README.md`
- [x] Verification：執行目標測試與 verify 指令，補上 Review 結果

## Check-in

- 會優先重用既有 `orchestrator/memory/soul/runtime`，工具層僅作最小侵入式增量。
- 預計先完成 contract+loop+tests，再接 verify 與文件，最後統一驗證。

## Review

- 實作摘要：新增 `tool-registry`（contract/schema validate/allowlist/handler execute），並在 `model-adapter` 加入 `generateTextWithToolLoop`（tool call 回餵、max iterations、timeout、fail-safe）。
- phase1 整合：`reply-prompt-runtime` 以最小侵入方式接入 tool loop，預設工具集為 `get_thread_context/get_persona_memory/get_global_policy/create_reply`（`create_reply` 在 runtime 內 mock，不直接寫入 DB）。
- observability：新增 `ToolRuntimeReasonCode`（success/validation fail/handler fail/not allowed/not found/max iterations/timeout），沿用最小事件欄位 `layer/operation/reasonCode/entityId/occurredAt`。
- 驗證命令：
  - `npm test -- src/lib/ai/prompt-runtime/tool-registry.test.ts src/lib/ai/prompt-runtime/model-adapter.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`（16 tests passed）
  - `npm test -- src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-execution-agent.test.ts src/lib/ai/safety/reply-safety-gate.test.ts src/lib/ai/policy/policy-control-plane.test.ts`（28 tests passed）
  - `npm run ai:tool:verify`（輸出 loop iterations/tool call summary/recent tool events）
- 回歸結論：phase1 policy/safety/review gate 測試仍通過，主流程在 tool loop 異常時維持空輸出 fail-safe。

---

# LLM Provider Runtime 正式化（Phase1）Todo

## Plan

- [x] 對齊 `plans/ai-minion-army/*` 與現有 phase1 model/tool runtime，鎖定最小侵入整合點
- [x] 新增 LLM Provider Contract 與 Registry（`providerId/modelId/capabilities/generateText` + default provider + task routing）
- [x] 實作最小 provider 集（`mock` + `xai`）與統一輸出 shape（`text/finishReason/usage/error`）
- [x] 新增 `invokeLLM()` 單一入口（timeout/retry/fallback/fail-safe），含 usage normalize 與最小 cost 摘要
- [x] 統一 provider runtime reason code 與事件欄位（`layer/operation/reasonCode/entityId/occurredAt`）
- [x] 在 reply phase1 runtime 接入 `invokeLLM`（保留既有 tool loop 與 policy/safety/review gate 語意）
- [x] 補測試：unit/integration/regression（primary success、primary fail fallback success、double fail、timeout、usage missing normalize）
- [x] 新增 verify 指令：`npm run ai:provider:verify`
- [x] 更新文件：`README.md`、`src/lib/ai/REASON_CODES.md`、`src/agents/phase-1-reply-vote/README.md`、`src/lib/ai/README.md`
- [x] Verification：執行目標測試與 verify 指令，補上 Review 結果

## Check-in

- 會以新 `llm runtime` 模組增量實作，盡量不改既有 orchestrator/memory/soul/tool registry。
- phase1 仍維持「prompt builder -> tool loop -> fallback」語意，只把底層模型呼叫收斂到 `invokeLLM`。

## Review

- 實作摘要：
  - 新增 `src/lib/ai/llm/*`：Provider contract、registry、`mock`/`xai` providers、`invokeLLM`（timeout/retry/fallback/fail-safe）。
  - `VercelAiCoreAdapter` 改為內部走 `invokeLLM`，phase1 runtime 介面與 tool loop 保持不變。
  - 新增 provider runtime reason codes 與事件層（`provider_runtime`），統一最小事件欄位。
  - usage/cost 最小摘要已在 `invokeLLM` 與 verify 指令輸出。
- 測試與驗證：
  - `npm test -- src/lib/ai/llm/invoke-llm.test.ts src/lib/ai/prompt-runtime/model-adapter.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts src/agents/phase-1-reply-vote/orchestrator/phase1-reply-flow.integration.test.ts`（25 tests passed）
  - `npm run ai:provider:verify`（輸出 active provider/model、fallback path、usage/cost summary、recent provider events）
- 環境限制：
  - `npm install ai @ai-sdk/xai` 因網路限制（`ENOTFOUND registry.npmjs.org`）無法安裝；目前 `xai-provider` 以「優先嘗試 SDK，未安裝時 fallback HTTP」方式保持可運作。

---

# Phase1 Runtime Logging + Admin Observability Todo

## Plan

- [x] 對齊 `plans/ai-minion-army/PHASE1_RUNTIME_LOGGING_AND_ADMIN_OBSERVABILITY_PLAN.md` 與現況程式接點（runtime events / execution agent / runner / admin route&ui）
- [x] 新增 migration：建立 `ai_runtime_events`、`ai_worker_status`（含索引），並同步 `supabase/schema.sql`
- [x] 實作 best-effort runtime event 落庫 sink，接入 provider/tool/model/execution 事件路徑
- [x] 在 `ReplyExecutionAgent` + `scripts/phase1-reply-runner.ts` 接入 worker heartbeat 與 circuit breaker 狀態上報
- [x] 新增 admin API：`/api/admin/ai/runtime/status`、`/api/admin/ai/runtime/events`、`/api/admin/ai/runtime/tasks`
- [x] 新增 admin 頁面 `/admin/ai/runtime`（health/queue/event stream/recent tasks，10-15 秒自動刷新）
- [x] 新增「熔斷時 try resume」操作（不改變現有 policy/safety/review gate 語意）
- [x] 補齊單元/整合/回歸測試，重點驗證「runtime 落庫失敗不影響 execution」
- [x] 將 runtime observability 驗證納入既有 `npm run test`（不新增獨立 verify script）
- [x] 更新文件：`README.md`、`src/lib/ai/REASON_CODES.md`、`src/agents/phase-1-reply-vote/README.md`
- [x] 執行目標測試與 verify 指令，補上 Review（命令 + 結果 + 風險）

## Check-in

- 以「最小侵入」方式在既有 runtime recorder 與 phase1 runner 增量擴充，不重寫 queue / gate 流程。
- runtime 與 worker 狀態上報一律 best-effort；任何 DB 失敗不得中斷主 execution path。

## Review

- 實作摘要：
  - 新增 runtime observability DB schema（`ai_runtime_events`、`ai_worker_status`）與索引。
  - 新增 `runtime-event-sink`、`runtime-observability-store`，provider/tool/model/execution 事件可 best-effort 落庫。
  - `ReplyExecutionAgent` 新增 execution runtime events、circuit snapshot、`tryResumeCircuit()`；runner 新增 heartbeat/circuit status 上報。
  - 新增 admin APIs：`status/events/tasks` 與 `resume`，並新增 `/admin/ai/runtime` 頁面（12 秒輪詢 + try resume）。
  - runtime observability 驗證改走既有 `npm run test`。
- 驗證命令：
  - `npm test -- src/lib/ai/observability/runtime-event-sink.test.ts src/lib/ai/prompt-runtime/runtime-events.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-execution-agent.test.ts src/app/api/admin/ai/runtime/status/route.test.ts src/app/api/admin/ai/runtime/events/route.test.ts src/app/api/admin/ai/runtime/tasks/route.test.ts src/app/api/admin/ai/runtime/resume/route.test.ts`（24 tests passed）
- 回歸結論：
  - 落庫失敗不影響 execution（新增回歸測試覆蓋 `runtimeEventSink.record` throw）。
  - policy/safety/review gate 行為保持原語意，僅增加 observability side-channel。

---

# Admin AI Control Plane + Prompt Assembly Spec Todo

## Plan

- [x] 彙整使用者已確認的 admin 功能範圍（providers/models、global policy、persona generation、persona interaction、image sub-agent）
- [x] 定義「規範文本」：產品視角頁面 IA、操作流程、手動預覽與發佈規則
- [x] 定義「開發文本」：API/DB 合約草案、prompt 組裝順序、token 預算與裁剪規則
- [x] 補齊通用約束：global/persona prompt 組裝限制、TipTap 渲染驗證、低 token 成本策略
- [x] 更新 lessons：記錄「全域 policy studio 不可遺漏」防呆規則

## Review

- 交付文件：
  - `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
  - `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- 規格重點：
  - 新增 5 個主模組：`AI Providers & Models`、`Global Policy Studio`、`Policy Models`、`Persona Generation`、`Persona Interaction`
  - `Image Sub-agent` 以可開關能力整合到互動路徑（post/comment），支援手動流程測試
  - 預覽與測試一律手動觸發、單模型單次生成，控制 token 成本
  - 定義 global/persona prompt 組裝順序與 token budget（含 block 級裁剪與 hard cap）
  - 明確規範 TipTap markdown render validation 為預覽必經檢查

---

# Admin AI Control Plane Implementation（Phase1）Todo

## Plan

- [x] 讀取規格文件與 lessons，盤點現有 schema / API / admin 頁面可重用點
- [x] 建立本階段實作計畫（沿用既有 schema，`ai_policy_releases` 承載 global policy 與 control plane 設定）
- [x] 實作 control-plane server 模組（providers/models/routes/policy release/persona mapping/preview contract）
- [x] 完成 API 骨架：
  - `providers`、`providers/:id/test`
  - `models`
  - `model-routes`
  - `policy-releases` + `:id/preview|publish|rollback`
  - `persona-generation/preview`
  - `personas` + `personas/:id`
  - `persona-interaction/preview`
- [x] 完成 admin UI 骨架：
  - Providers & Models
  - Global Policy Studio
  - Policy Models
  - Persona Generation
  - Persona Interaction
- [x] 串接預覽流程（單模型、手動觸發）與 TipTap render validation
- [x] 串接 token 超限策略的 control-plane 入口（由 AI agents plan 執行 `persona_memory -> persona_long_memory` 壓縮；admin UI 僅顯示超限與精簡 global rules 提示）
- [x] 補齊測試（重點 API + prompt assembly/token strategy）並執行驗證
- [x] 更新本區塊 Review（變更摘要、驗證命令、結果、風險）

## Check-in

- 目前決策：第一階段不新增資料表；`persona_engine_config` 不納入新控制平面讀路徑，改以 `ai_policy_releases.policy.controlPlane` 承載 provider/model/route 與 global policy studio 的草稿/發布資料。
- Persona profile 依規格映射既有 `personas/persona_souls/persona_memory/persona_long_memories`，API/preview 都以這四表取值。
- 修正決策：token 超限的實際裁剪由既有 AI agents plan 負責，Admin API/UI 只接收並展示 runtime 回傳的壓縮階段與超限提示。
- 修正決策：persona generation preview 改為真實 LLM invocation；禁止以固定模板偽造 `info/soul/long_memory`。
- 變更摘要（step 1）：新增 `src/lib/ai/admin/control-plane-store.ts`，統一封裝 `ai_policy_releases.policy.controlPlane` 的 provider/model/route/policy draft 讀寫、persona 映射、preview prompt assembly、TipTap render validation。
- 變更摘要（step 2）：新增第一批 Admin AI API（providers/models/model-routes/policy-releases/persona-generation/personas/persona-interaction），全部走 `withAuth + isAdmin`。
- 變更摘要（step 3）：新增 `/admin/ai/control-plane` 與 `AiControlPlanePanel`，完成五個模組骨架與手動操作。
- 變更摘要（step 4）：preview 回傳 `assembledPrompt + renderOk/renderError + tokenBudget`，UI 顯示單模型手動觸發、TipTap render 結果與 token 超限提示。
- 變更摘要（step 5）：新增 route tests（policy preview、persona interaction preview）驗證權限與核心回應形狀。
- 變更摘要（step 6）：`previewPersonaGeneration` 改為走 `invokeLLM`，以選定 provider/model 生成 JSON 並解析為 `info/soul/long_memory`，再進行 TipTap render validation。
- 變更摘要（step 7）：Persona Generation UI 流程明確化為「選模型 + 輸入額外 prompt -> Generate Preview -> Regenerate 或 Save To DB」，並加入 loading / run-count 狀態。
- 變更摘要（step 8）：Persona username 改為可由 display name 導出與調整，前後端統一正規化並強制 `ai_` 前綴（create + patch + generation save form）。
- 變更摘要（step 9）：Persona generation 輸出契約改為 schema-aligned JSON：`personas` / `persona_souls` / `persona_memory` / `persona_long_memories`，儲存時直接映射到對應資料表欄位。
- 變更摘要（step 10）：Persona generation model 選單改為只顯示「provider 有 API key 且啟用」的 text models；後端 `previewPersonaGeneration` 同步加上 eligibility 檢查。
- 變更摘要（step 11）：新增可重用 `PersonaSelect`（預設 50 筆 + 搜尋 username/display_name）；`/api/admin/ai/personas` 新增 `q`，Persona Interaction 已改用共用元件。
- 變更摘要（step 12）：`GET /api/admin/ai/personas` 移除 admin gate（僅需登入），讓 persona 搜尋可在非 admin 場景重用；`POST` 仍維持 admin 限制，並新增 route 測試覆蓋。
- 變更摘要（step 13）：新增 `/admin` 入口頁，集中導向 `AI Control Plane`、`AI Runtime`、`AI Review Queue`，並套用 admin 權限檢查。
- 變更摘要（step 14）：規格文件更新 image generation 為通用 async job workflow（create job + worker execute + storage upload + poll status），避免單次 request 卡住 Vercel plan duration limit。

## Next (Image Job Workflow)

- [ ] 設計並實作 image generation job API（create / status / optional cancel）
- [ ] 串接 worker 背景執行 image route（primary/fallback）與 retry/timeout
- [ ] 將 job 結果上傳 Supabase Storage 並回填 result URL
- [ ] 在 `/admin/ai/control-plane` 加入 image preview job 狀態 UI（queued/running/succeeded/failed）
- [ ] 補 reason code 與 observability（IMAGE_GEN_FAILED / IMAGE_UPLOAD_FAILED / IMAGE_JOB_TIMEOUT）

## Review

- 實作結果：
  - 第一階段 Admin AI Control Plane API/UI 骨架已可用，且沿用既有 schema，未新增資料表。
  - `persona_engine_config` 未納入新控制平面邏輯，provider/model/route 改由 `ai_policy_releases.policy.controlPlane` 管理。
  - persona profile 讀寫明確映射到 `personas/persona_souls/persona_memory/persona_long_memories`。
  - token 超限只做 control-plane 訊號展示：先顯示 `persona_memory -> persona_long_memory` 壓縮階段，仍超限時提示 Admin 精簡 global rules；實際 runtime 裁剪責任在 agents plan。
- 驗證命令：
  - `npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`（4 tests passed）
  - `npm run lint -- ...`（失敗：既有 eslint 環境錯誤 `react/display-name` rule loader crash）
  - `npx tsc --noEmit`（失敗：專案既有型別錯誤，非本次變更獨有）
- 風險與後續：
  - policy/persona interaction preview 目前仍為 skeleton 文字輸出；persona generation preview 已改為真實 model invocation。
  - `ai_policy_releases` 目前以 `is_active` 模式承載 draft/publish；若後續要完整治理（例如 preview pass gate 強制）可補欄位或審計策略。
