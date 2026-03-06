## 2026-03-06 Action Output Contract Plan

### Plan

- [x] 將互動 prompt contract 從 generic `output_constraints` 改為 action-type specific contract
- [x] 新增 `target_context` block，供 `vote` / `poll_vote` / 需要 target 的互動任務判斷
- [x] 定義 `post` / `comment` 的 structured image request contract，由後端回填 markdown 圖片 URL
- [x] 定義 `vote` / `poll_post` / `poll_vote` 的 structured output contract，不與 markdown 任務共用格式
- [x] 補 preview/runtime/tests 覆蓋各 action type 與 empty target fallback

### Check-in

- [x] Step 1：先更新 spec 與 shared AI docs，明確寫出各 action type output contract
- [x] Step 2：擴充 shared prompt builder，加入 `actionType`、`target_context`、action-specific `output_constraints`
- [x] Step 3：更新 admin interaction preview contract，讓 preview 可帶 target/poll context
- [x] Step 4：在 markdown 任務 runtime 加入 structured image request parser/boundary
- [x] Step 5：在 vote / poll runtime 加入 target-specific structured decision contract
- [x] Step 6：跑 targeted vitest + focused tsc，回填 Review

### Review

- 實作摘要：
  - `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`、`src/lib/ai/README.md`、`src/agents/phase-1-reply-vote/README.md` 已同步改成 action-specific contract，正式加入 `target_context` block 與 markdown/image request、vote/poll structured contracts。
  - `src/lib/ai/prompt-runtime/prompt-builder.ts` 現在要求 `actionType`，固定輸出 `target_context`，並對 `post / comment / vote / poll_post / poll_vote` 產生不同 `output_constraints`。
  - admin preview route/store 已接受 action-specific `targetContext`，可組出 populated/empty `target_context`，並在 preview prompt 反映 vote/poll 的 strict structured contract。
  - reply runtime 現在以 `comment` contract 組 prompt，並透過 shared parser 萃取 `need_image / image_prompt / image_alt`。
  - 新增 `src/lib/ai/prompt-runtime/action-output.ts`，集中處理 markdown action parser、vote/poll structured parser、image job enqueue boundary，以及後端 resolved image markdown 插入。
  - 目前 repo 沒有現成 vote/poll orchestrator 可直接接，因此 decision-action runtime 先落在 shared parser/boundary；後續 orchestrator 可直接復用。
- 驗證：
  - `rg -n "target_context|poll_vote|poll_post|need_image|image_prompt|image_alt" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md src/agents/phase-1-reply-vote/README.md`
  - `npx vitest run 'src/lib/ai/prompt-runtime/prompt-builder.test.ts'`
  - `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts'`
  - `npx vitest run 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
  - `npx vitest run 'src/lib/ai/prompt-runtime/action-output.test.ts'`
  - `npx vitest run 'src/lib/ai/prompt-runtime/prompt-builder.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts' 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts' 'src/lib/ai/prompt-runtime/action-output.test.ts'`
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "prompt-builder|persona-interaction/preview|reply-prompt-runtime|action-output|control-plane-store|vote|poll|image_prompt|target_context"`
- 結果：
  - vitest：5 files / 30 tests passed。
  - focused tsc：本次 touched areas 無錯誤。

## 2026-03-06 Board Context Prompt Block Plan

### Plan

- [x] 更新 prompt assembly 規格，正式加入 `board_context` block
- [x] 調整 admin persona interaction preview contract，支援 board `name/description/rules`
- [x] 調整 shared/runtime prompt builder，將 `board_context` 放在 memory 與 `task_context` 之間
- [x] 補測試覆蓋「有 board info」與「沒有 board info」兩種 prompt 組裝結果
- [x] 執行 targeted 驗證並回填 Review

### Check-in

- [x] Step 1：先更新 `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md` 與 `src/agents/phase-1-reply-vote/README.md`
- [x] Step 2：擴充 preview route/store input，讓 admin interaction preview 可顯式傳入 board context
- [x] Step 3：修改 `src/lib/ai/prompt-runtime/prompt-builder.ts` 與 reply runtime 組裝 `board_context`
- [x] Step 4：補 route/runtime tests，確認 populated 與 empty board cases
- [x] Step 5：跑 vitest + focused tsc，將結果寫回 Review

### Review

- 實作摘要：
  - 互動 prompt contract 已正式加入獨立 `board_context` block，位置在 memory 與 `task_context` 之間。
  - admin persona interaction preview route/store 現在可接受 board `name / description / rules`，並在 assembled prompt 中輸出 `board_context`。
  - shared prompt builder 與 phase1 reply runtime 已加入 `board_context` fallback：缺 board 時固定輸出 `No board context available.`。
  - `SupabaseTemplateReplyGenerator` 會在有 `boardId` 時額外查詢 `boards` 表，將 board metadata 帶入正式 runtime prompt。
- 驗證：
  - `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts' 'src/lib/ai/prompt-runtime/prompt-builder.test.ts' 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "persona-interaction/preview/route.ts|control-plane-store.preview-persona-interaction.test.ts|prompt-builder|reply-prompt-runtime|supabase-template-reply-generator|board_context"`
- 結果：
  - vitest：4 files / 12 tests passed。
  - focused tsc：本次變更檔案無新增錯誤；仍有既有錯誤在 `src/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator.test.ts`，與這次修改無關。

## 2026-03-05 AI Policy Verify Workflow Refresh Plan

### Plan

- [x] 確認 `AI Policy Verify` workflow 的過時點與現行 policy 驗證入口
- [x] 更新 `.github/workflows/ai-policy-verify.yml`，改為可用且對 policy 有效的檢查
- [x] 同步修正文檔中過時的 `ai:policy:verify` 指令
- [x] 執行 targeted 驗證命令，並回填 Review

### Check-in

- [x] Step 1：先調整 workflow 使 CI 不再呼叫不存在 script
- [x] Step 2：更新 `src/lib/ai/policy/README.md` 與 `src/lib/ai/README.md` 的驗證命令
- [x] Step 3：跑 policy 相關測試並確認 workflow 指令本地可執行

### Review

- 實作摘要：
  - `AI Policy Verify` workflow 移除過時的 secret gate 與 `npm run ai:policy:verify`。
  - workflow 改為直接執行 policy 單元測試：
    - `src/lib/ai/policy/policy-control-plane.test.ts`
    - `src/lib/ai/policy/reply-interaction-eligibility.test.ts`
  - `src/lib/ai/policy/README.md`、`src/lib/ai/README.md` 已同步移除舊指令並改為新測試命令。
- 驗證：
  - `npm test -- src/lib/ai/policy/policy-control-plane.test.ts src/lib/ai/policy/reply-interaction-eligibility.test.ts`
  - 結果：2 files / 15 tests passed。

## 2026-03-04 SystemBaseline Key Migration Plan

### Plan

- [x] 將 policy draft key 從 `coreGoal` 全面改為 `systemBaseline`（前端 state/type + API payload）
- [x] 更新 `AdminAiControlPlaneStore` 的讀寫與 prompt 組裝欄位映射
- [x] 新增 migration，將 `ai_policy_releases.policy.global.coreGoal` 轉換為 `systemBaseline`
- [x] 同步更新 `supabase/schema.sql`
- [x] 跑 typecheck 與 preview route tests，回填 review

### Review

- 實作摘要：
  - 前端 `DraftState` 與 Policy Draft 編輯欄位 key 已改為 `systemBaseline`。
  - `POST /api/admin/ai/policy-releases` payload key 已改為 `systemBaseline`。
  - `AdminAiControlPlaneStore` 讀寫 `policy.global.systemBaseline`，並移除 `coreGoal` 使用。
  - prompt 組裝 `system_baseline` block 改讀 `globalDraft.systemBaseline`。
  - 新增 migration：`20260304182000_policy_core_goal_to_system_baseline.sql`，將既有 JSON key 轉換。
  - `supabase/schema.sql` 已同步加入相同 contract migration block。
- 驗證：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "systemBaseline|policy-releases/route|useAiControlPlane|control-plane-store|PolicyStudioSection" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[version]/preview/route.test.ts'`
  - 結果：typecheck 過濾檢查無錯誤；vitest 1 file / 2 tests passed

## 2026-03-04 Policy Release Route Segment Rename Plan

### Plan

- [x] 將 `policy-releases/[id]/preview` 目錄改名為 `policy-releases/[version]/preview`
- [x] 將 `policy-releases/[id]/rollback` 目錄改名為 `policy-releases/[version]/rollback`
- [x] 同步更新 route handler params 型別與相關測試引用
- [x] 執行對應測試驗證路由改名後仍可正常運作

### Review

- 實作摘要：
  - API 檔名與動態參數段已由 `[id]` 統一為 `[version]`（preview / rollback）。
  - route handler 泛型與 `params` 解構同步改為 `version`。
  - preview route test 的 route context 型別與測試描述已改為 `:version`。
- 驗證：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "policy-releases/\\[version\\]|preview/route|rollback/route|useAiControlPlane|PolicyStudioSection|AiControlPlanePanel" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[version]/preview/route.test.ts'`
  - 結果：typecheck 過濾檢查無錯誤；vitest 1 file / 2 tests passed

## 2026-03-04 ReleaseId -> Version Naming Unification Plan

### Plan

- [x] 前端 policy preview state 與 handler 命名由 `releaseId` 統一為 `version`
- [x] policy-releases POST payload `releaseVersion` 統一為 `version`
- [x] policy-releases DELETE query `id` 統一為 `version`
- [x] Policy section callback 命名由 `viewPolicyRelease` 統一為 `viewPolicyVersion`
- [x] 驗證型別與 preview route tests

### Review

- 實作摘要：
  - `policyPreviewInput.releaseId` 已改為 `policyPreviewInput.version`。
  - `POST /api/admin/ai/policy-releases` body 欄位改為 `version`。
  - `DELETE /api/admin/ai/policy-releases` query 欄位改為 `version`。
  - Policy UI props/callback 改為 `viewPolicyVersion(version)`，避免語意混亂。
  - rollback/preview route 錯誤訊息改為 `invalid version`。
- 驗證：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "useAiControlPlane|PolicyStudioSection|AiControlPlanePanel|policy-releases/route|control-plane-store|policy-releases/\\[id\\]/(preview|rollback)/route" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts'`
  - 結果：typecheck 過濾檢查無錯誤；vitest 1 file / 2 tests passed

## 2026-03-04 Policy Preview Model-Decoupling Plan

### Plan

- [x] 移除 policy preview API 的 `modelId` 需求
- [x] `previewGlobalPolicyRelease` 改為純 policy 組裝（不查 model/provider）
- [x] 前端 preview helper 改為只傳 `releaseId + taskContext`
- [x] 更新 preview route tests 與驗證結果

### Review

- 實作摘要：
  - `POST /api/admin/ai/policy-releases/:id/preview` 不再要求 `modelId`。
  - store `previewGlobalPolicyRelease(version, taskContext)` 改為 policy-only prompt assembly。
  - `Policy Draft` 的 Preview/Regenerate 走相同新 contract，不依賴 model。
  - markdown 說明更新為 policy-only preview，避免誤解成 model invocation。
- 變更檔案：
  - `src/app/api/admin/ai/policy-releases/[id]/preview/route.ts`
  - `src/lib/ai/admin/control-plane-store.ts`
  - `src/hooks/admin/useAiControlPlane.ts`
  - `src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts`
- 驗證：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "useAiControlPlane|preview/route|control-plane-store" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts'`
  - 結果：typecheck 過濾檢查無錯誤；vitest 1 file / 2 tests passed

## 2026-03-04 Policy Draft Prompt Preview Modal Plan

### Plan

- [x] 在 Policy Draft 加入 `Preview` 按鈕，點擊後開 modal
- [x] modal 內顯示 assembled prompt 並提供 copy button
- [x] 串接既有 policy preview API，改為以當前 selected release 產生 prompt
- [x] 驗證型別與互動流程，補充 review

### Check-in

- [x] Step 1：在 hook 新增 preview helper，固定以當前 `draft.selectedVersion` 執行 preview
- [x] Step 2：在 Policy section 新增 preview modal 與 copy interaction
- [x] Step 3：跑 `tsc` 快速驗證並回填 review

### Review

- 實作摘要：
  - `Policy Draft` 右上新增 `Preview` 按鈕，點擊後開 modal。
  - modal 顯示 `assembledPrompt`（readonly textarea），可 `Regenerate` 與 `Copy Prompt`。
  - Preview 執行來源改為當前 `draft.selectedVersion`，確保看到的是當下選定版本政策組裝後的 prompt。
- 主要變更檔案：
  - `src/hooks/admin/useAiControlPlane.ts`：新增 `previewSelectedPolicyDraft()`
  - `src/components/admin/AiControlPlanePanel.tsx`：傳遞 preview 狀態與 handler 到 Policy section
  - `src/components/admin/control-plane/sections/PolicyStudioSection.tsx`：新增 Preview modal + Copy
- 驗證命令：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "PolicyStudioSection|AiControlPlanePanel|useAiControlPlane" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts'`
- 驗證結果：
  - tsc 過濾檢查：無錯誤
  - vitest：1 file / 2 tests passed

## 2026-03-03 Admin Control Plane Policy UI Refactor Plan

### Plan

- [x] 移除 Header 的 version selector / Update / Rollback / Publish（保留 refresh）
- [x] 調整 Policy 模組排列為 `Releases -> Policy Draft`，移除 `Manual Preview` card
- [x] Releases 清單改為 version DESC，並加入每頁 5 筆 pagination UI
- [x] Releases actions 改為 `View / Rollback / Delete`，依 current/old 狀態控制可用性
- [x] Policy card 右上加入 `Update / Delete / Publish`，並加上 delete/publish confirm modal
- [x] 更新前端 hook 與 API：`Update` 可更新 current/old，`Publish` 以 insert next version 並使其他版本 inactive
- [x] 執行 targeted 驗證（typecheck + policy release 相關測試）並填寫 Review

### Check-in

- [x] Step 1：重構 `AiControlPlanePanel` header，移除版本操作並把 modal 管理收斂到 Policy 區塊
- [x] Step 2：重構 `PolicyStudioSection` 版面與卡片順序，新增 releases pagination + actions 行為
- [x] Step 3：擴充 `useAiControlPlane` 的 policy 操作 API（view/update/publish/delete/rollback）與 enable/disable 判斷
- [x] Step 4：調整 `policy-releases` route/store 邏輯，允許更新指定 release 與顯式 publish
- [x] Step 5：跑驗證並回填 Review 結果與風險

### Review

- 實作摘要：
  - `AiControlPlanePanel` header 已移除 version selector / Update / Rollback / Publish，只保留 refresh。
  - Policy 區塊重排為 `Releases -> Policy Draft`，並移除 `Manual Preview` card。
  - Releases 改為 version DESC，新增每頁 5 筆 pagination（Prev/Next + page indicator）。
  - Releases actions 套用狀態矩陣：current 只能 View；old 可 View/Rollback/Delete。
  - Policy Draft 右上新增 `Update / Delete / Publish`；Delete（old only）與 Publish 均有 confirm modal。
  - 後端 `POST /api/admin/ai/policy-releases` 新增 `action` 與 `releaseVersion`：
    - `action=update` 可更新指定 release（current 或 old）。
    - `action=publish` 會 insert 新 active release，並將其他 release 設為 inactive。
- 驗證命令：
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "AiControlPlanePanel|PolicyStudioSection|useAiControlPlane|policy-releases/route|control-plane-store|admin/ai/control-plane/page" -n || true`
  - `npx vitest run 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts'`
  - `npm run lint -- src/components/admin/AiControlPlanePanel.tsx src/components/admin/control-plane/sections/PolicyStudioSection.tsx src/hooks/admin/useAiControlPlane.ts src/app/api/admin/ai/policy-releases/route.ts src/lib/ai/admin/control-plane-store.ts src/app/admin/ai/control-plane/page.tsx`
- 驗證結果：
  - tsc（針對本次變更檔案過濾）：無錯誤。
  - vitest：1 file / 2 tests passed。
  - lint：失敗（既有環境問題：`react/display-name` rule loader crash）。

# AI Control Plane Update Todo (Providers/Policy/Routes/Persona/Preview)

## Plan

- [x] 盤點 `/admin/ai/control-plane` Providers/Models 現有互動與 API 能力，確認可行變更點
- [x] 調整 Providers/Models 為「列表即控制台」：Provider 顯示 key 狀態、Model 分 text/image
- [x] 移除 Add Provider 按鈕，改為從 Provider List 點 API Key 動作開 modal 設定
- [x] Model list 支援勾選開關與順序調整（#1 primary / #2 fallback）
- [x] 新增 model test + active gating：provider key + model test success 才可 active
- [x] 更新相關文檔（AI Admin spec）反映最新 Providers/Models 操作規則
- [x] 執行測試/驗證並填寫 Review

## Check-in

- [x] Step 1：重新定義資料流：Provider 用 `SUPPORTED_PROVIDERS` 固定列出；Model 以 `SUPPORTED_MODELS + routes` 推導勾選與順序。
- [x] Step 2：Provider list 改成只呈現 configured/missing，並從 row action 打開 API key modal。
- [x] Step 3：Model list 拆成 Text/Image 兩組，提供勾選、上下調整順序、test 與 active toggle。
- [x] Step 4：新增 hook `runModelTest`（寫入 metadata.modelTestStatus）與 `setModelActive`（啟用前強制檢查）。
- [x] Step 5：`configureSupportedModels` 改為新建 model 預設 `disabled`，並以選取順序更新 route。
- [x] Step 6：更新 `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md` 對應新 UI/規則。
- [x] Step 7：執行 tests / lint / tsc 驗證並記錄結果。

## Review

- 實作摘要：
  - Provider list 現在只顯示 API key configured/missing，透過 row 的 `API Key` 按鈕開 modal 設定。
  - Model list 分 Text Models / Image Models，支援勾選啟用、順序調整、model test、active on/off。
  - Active 開啟前必須符合：provider hasKey + modelTestStatus=success。
  - 勾選順序直接同步到 route（primary/fallback），並限制每種能力最多 2 個。
- 驗證命令：
  - `npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/app/api/admin/ai/personas/route.test.ts'`
  - `npm run lint -- src/components/admin/control-plane/sections/ProvidersModelsSection.tsx src/components/admin/AiControlPlanePanel.tsx src/hooks/admin/useAiControlPlane.ts`
  - `npx tsc --noEmit --pretty false`
- 測試結果：
  - vitest：3 suites / 6 tests passed。
  - lint：失敗（既有環境問題：`react/display-name` rule loader crash）。
  - tsc：失敗（既有專案錯誤，主要在 `.next/types`、`src/agents/*`、`src/lib/ai/evaluation/*`、`src/lib/ai/memory/*`）。
- 風險與後續：
  - `model test` 目前為 control-plane 層級 gate（依 provider key + provider test），若要升級為真實 provider/model 探測，可新增獨立後端 test endpoint 做實際 invocation。

## 2026-03-02 Capability-First Routing Plan

- [x] 將 admin 控制台的 route 顯示與同步改為 capability 導向（`text_generation` / `image_generation`），不再以互動類型分類
- [x] 更新 `useAiControlPlane` 路由衍生與寫回邏輯，僅同步 text/image 兩條 route
- [x] 更新 `/api/admin/ai/model-routes` GET 回傳為 capability-first 視圖（相容舊資料）
- [x] 調整 Model Routing UI 文案與 scope 列表，避免誤導為 post/comment 綁定模型
- [x] 驗證重排後不再觸發多餘 GET，並補上 review/結果

## Check-in (Capability-First)

- [x] Step 1：先保留底層舊 scope 型別相容，僅改 admin 讀寫/顯示來源為 capability-first
- [x] Step 2：hook `buildDerivedRoutesFromActiveOrder` 與 `syncRoutesFromActiveModelOrder` 只產生 text/image 對應 scope
- [x] Step 3：`model-routes` GET 回傳能力導向 route 集合，UI 僅顯示這兩條
- [x] Step 4：跑 targeted tests 並人工檢查請求數量/行為

## Review (Capability-First)

- 實作摘要：
  - Model routes 改為 capability-first：Text (`global_default`) + Image (`image`)。
  - Admin UI 的 Model Routing 文案改為能力導向，不再暗示 post/comment/persona 各自綁模型。
  - `/api/admin/ai/model-routes` GET 改為輸出兩條衍生 route，避免舊資料造成錯誤認知。
  - `useAiControlPlane` 寫回 routes 時只同步兩條 route，減少不必要 payload 與心智負擔。
- 驗證命令：
  - `npm test -- 'src/lib/ai/llm/runtime-config-provider.test.ts' 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`
- 測試結果：
  - vitest：3 suites / 6 tests passed。

## 2026-03-02 Policy Version Integer Label + Save Overwrite Plan

- [x] 調整 policy studio 版標為整數（`1,2,3...`），並與 release row id 分離
- [x] 後端改為預設 save 覆蓋 active release（不新增 draft row）
- [x] API `POST /api/admin/ai/policy-releases` 改為 save 行為並接受 `policyVersion`
- [x] UI 改為 `Save Policy`，新增整數版標輸入並顯示 `v{policyVersion}` 與 `release #id`
- [x] 執行 targeted 測試與記錄驗證結果

## Review (Policy Version Integer Label + Save Overwrite)

- 實作摘要：
  - `ai_policy_releases.version` 保留作 release row id（preview/publish/rollback 路由 id）。
  - Policy 版標改為 `controlPlane.globalPolicyVersion`（整數），由 admin 手動輸入。
  - Save Policy 預設更新 active release 的 `policy/change_note/created_by`，若無 active 才建立第一筆 active release。
  - Releases 表格與 header badge 顯示 `policyVersion`，並附 `release #id` 避免混淆。
- 驗證命令：
  - `npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`
  - `npm run lint -- src/components/admin/control-plane/sections/PolicyStudioSection.tsx src/hooks/admin/useAiControlPlane.ts src/lib/ai/admin/control-plane-store.ts src/app/api/admin/ai/policy-releases/route.ts src/components/admin/AiControlPlanePanel.tsx`
- 測試結果：
  - vitest：2 suites / 4 tests passed。
  - lint：失敗（既有環境問題：`react/display-name` rule loader crash）。

## 2026-03-02 Control Plane UX/API Bugfix Plan

- [x] Policy Studio 版標改為 selector，預設 latest，提供 latest+1 選項
- [x] Model reorder 改為單一 API，移除前端逐筆 patch 與額外 model-routes put
- [x] 後端 bulk reorder 同次更新 model `displayOrder` 與 capability routes
- [x] bulk reorder 改為更新 active release row policy，避免拖拉一次產生多筆 release rows
- [x] 執行 targeted tests 並記錄結果

## Review (Control Plane UX/API Bugfix)

- 實作摘要：
  - Policy Studio 增加 version selector，預設選最新版標，並提供下一版（latest+1）。
  - `PUT /api/admin/ai/models` 新增 bulk reorder，payload: `{ capability, orderedModelIds }`。
  - 前端 drag&drop 後僅發出一個 reorder API，回填 models/routes，不再額外呼叫 `/api/admin/ai/model-routes`。
  - 後端 reorder 會在同一次操作中更新 `displayOrder` + 衍生 routes，並直接覆蓋 active release row 的 `policy`。
- 驗證命令：
  - `npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`
- 測試結果：
  - vitest：2 suites / 4 tests passed。

## 2026-03-03 Provider Secret Fallback + MiniMax Test Cleanup Plan

- [x] 將 provider secret 讀取邏輯統一為 `DB secret first, .env fallback second`（admin/runtime 共用）
- [x] 讓 provider list `hasKey/keyLast4` 也吃相同 fallback 規則，避免 UI 與 runtime 狀態不一致
- [x] 清理 model test 成功條件的冗餘判斷，保留可用性判斷（`error/finishReason`）
- [x] 新增 `provider-secrets` 測試覆蓋 env fallback、missing table、db 優先、decrypt 失敗回退
- [x] 更新文件與 `.env.example` 說明 fallback 優先序

## Review (Provider Secret Fallback + MiniMax Test Cleanup)

- 實作摘要：
  - `src/lib/ai/llm/provider-secrets.ts` 新增 env fallback（`XAI_API_KEY` / `MINIMAX_API_KEY`），DB 優先、env 次之。
  - `listProviderSecretStatuses` 與 `loadDecryptedProviderSecrets` 現在都套用同一份 fallback 規則，admin control panel 與 runtime 行為一致。
  - `loadDecryptedProviderSecrets` 遇到 decrypt 失敗時不會整體中斷，會回退 env key（若有）。
  - `src/lib/ai/admin/control-plane-store.ts` 清理 model test 成功條件冗餘分支。
  - `.env.example` 與 `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md` 已補上 fallback 說明。
- 驗證命令：
  - `npx vitest run src/lib/ai/llm/provider-secrets.test.ts src/lib/ai/llm/providers/minimax-provider.test.ts src/lib/ai/llm/invoke-llm.test.ts`
- 測試結果：
  - vitest：3 files / 14 tests passed。

## 2026-03-03 AI Models Table Migration Plan

- [x] 新增 `public.ai_providers` / `public.ai_models` / `public.ai_model_routes` migration（含索引與 service-role RLS policy）
- [x] 同步更新 `supabase/schema.sql`（與 migration 一致）
- [x] `AdminAiControlPlaneStore` 改為從 inventory tables 讀寫 provider/model/route（不再以 `policy.controlPlane.providers/models/routes` 為真相）
- [x] 保留 `ai_policy_releases` 僅管理 policy draft/version，provider/model/route 變更不再寫入 release policy
- [x] `/api/admin/ai/model-routes` GET 改為讀取 `ai_model_routes`（不再即時計算覆蓋）
- [x] LLM runtime fallback 改為 DB inventory tables（`ai_providers` + `ai_models`）
- [x] 執行針對性檢查並記錄 review

## Review (AI Inventory Table Split)

- 實作摘要：
  - 新增 migration：`supabase/migrations/20260303103000_ai_control_plane_inventory_tables.sql`。
  - 新增三張表：`ai_providers`、`ai_models`、`ai_model_routes`，含 RLS + service role policies + 索引 + default route rows。
  - `AdminAiControlPlaneStore` 的 provider/model/route CRUD、model test、reorder、runtime error 記錄，全部改為直接寫新表。
  - `ai_policy_releases` 現在僅承載 policy draft/version（save/publish/rollback），不再承載 inventory。
  - `runtime-config-provider` fallback 路由來源改為 `ai_providers` + `ai_models`。
- 驗證命令：
  - `npx tsc --noEmit --pretty false 2>&1 | rg "control-plane-store|runtime-config-provider|model-routes/route" -n || true`
  - `npm run lint`（失敗：專案既有 ESLint/react plugin 相容問題）
  - `npx tsc --noEmit`（失敗：專案既有型別錯誤，非本次改動）

## 2026-03-03 Route Legacy Final Removal + Capability Order Fix Plan

- [x] 修正 `ai_models.display_order` 預設值為 capability 內排序（text/image 各自從 0 起算）
- [x] 移除 `ai_model_routes` 於 admin store 的讀寫依賴（不再維護 routes 狀態）
- [x] 刪除 `/api/admin/ai/model-routes` API 與前端 hook/UI 對應流程
- [x] 移除 Control Plane 的 Routes 分頁與相關型別/工具函式
- [x] 同步文件與 schema 描述，將舊路由框架標記為已移除
- [x] 執行 targeted tests 驗證 runtime + inventory 邏輯

## Check-in (Route Legacy Final Removal + Capability Order Fix)

- [x] Step 1：先改 store `upsertModel` 的 `displayOrder` fallback（capability scoped）
- [x] Step 2：刪除 store 內 route methods 與 mutation 觸發的 route upsert calls
- [x] Step 3：刪除 `model-routes` API、hook 的 route state/請求、panel routes section
- [x] Step 4：同步 docs/schema，確保敘述改為「已移除舊 route framework」
- [x] Step 5：跑 vitest（runtime-config + model-adapter + invoke + active-order）並回填 review

## Review (Route Legacy Final Removal + Capability Order Fix)

- 實作摘要：
  - `upsertModel` 的預設 `displayOrder` 改為 capability 內計數，不再使用全域 `models.length`。
  - `AdminAiControlPlaneStore` 已移除所有 `ai_model_routes` 讀寫、`updateRoutes`、`buildCapabilityRoutes` 與相關 mutation side-effects。
  - 刪除 `GET/PUT /api/admin/ai/model-routes` 與 `ModelRoutingSection`，`useAiControlPlane` 不再維護 routes state。
  - `ProvidersModelsSection` 排序來源改為 `ai_models.displayOrder`（capability 分組），不再讀 route/metadata fallback。
  - 文件改為「舊 route 框架已移除，改用 active model order（by capability）」。
- 驗證命令：
  - `npx vitest run src/lib/ai/llm/default-model-config.test.ts src/lib/ai/llm/active-order-inventory.test.ts src/lib/ai/llm/invoke-llm.test.ts src/lib/ai/prompt-runtime/model-adapter.test.ts src/lib/ai/llm/runtime-config-provider.test.ts`
  - `npx tsc --noEmit --pretty false 2>&1 | rg -n "control-plane-store|useAiControlPlane|AiControlPlanePanel|ProvidersModelsSection|control-plane-types|control-plane-utils|api/admin/ai/models/route|admin/ai/control-plane/page" -n`
- 測試結果：
  - vitest：5 files / 27 tests passed。
  - tsc filter：本次改動相關檔案無型別錯誤。
