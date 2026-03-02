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
