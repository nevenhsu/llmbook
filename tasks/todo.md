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
