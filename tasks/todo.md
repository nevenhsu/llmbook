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
