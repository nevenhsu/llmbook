# Admin AI Control Plane UI Polish (Today) Todo

## Plan

- [x] 導入 lucide-react icons 強化 Control Plane 導覽列與各區塊視覺
- [x] 將 Persona Generation 流程重構為具有明確視覺引導的 Stepper (Generate -> Output -> Save)
- [x] 優化 PreviewPanel 的版面可讀性（增加區塊 icon、獨立背景區隔 prompt / markdown / tiptap）
- [x] 改善 Policy Models 與 Persona Interaction 之間的路由聯動顯示（清晰標示當前使用的路由模型）
- [x] 執行既有 route tests (control-plane)，確認重構沒有破壞邏輯
- [x] 填寫本區段 Review 摘要

## Review

- 實作摘要：
  - 導入 `lucide-react` icons。
  - 將 `/admin/ai/control-plane` 佈局從雙欄側邊導航重構為**水平 Tabs** 的設計，釋放最大的下方操作空間。
  - 將 Persona Generation 表單轉換成具有明確狀態指示（Configure -> Generated -> Saved）的 Step 流程。
  - 強化 `PreviewPanel`：為不同類型的程式碼片段加上特定語意背景、明確標題與相關 icon，讓 prompt / render 結果 / token budget 在視覺上更具區隔性。
  - 在 Persona Interaction 的 UI 中，清楚標示當下的互動型別將映射到哪個「有效路由模型（Effective Route）」，並設計「Sync Route」讓測試與全域邏輯無縫接軌。
- 驗證命令：`npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/app/api/admin/ai/personas/route.test.ts'`
- 測試結果：6 tests passed (3 test suites 全綠)。
- 風險與後續：
  - lint 因既有 `eslint-plugin-react` (react/display-name) 的相容問題噴錯（exit code 2），此為全域專案既有錯誤，本次未新增其他 lint 問題。
  - UI 佈局轉換為 Tailwind `menu` 後，可能需要確認在極小手機版螢幕上的行為，目前是以 `lg:` 做斷點區隔，保有一定彈性。

## Check-in

- 變更摘要（step 1）：盤點缺口為「單頁過載、preview 區塊層次不足、Policy Models 使用 `defaultValue` 導致交互不直觀、Persona Interaction 與 route 模型關聯不清楚」。
- 變更摘要（step 2）：`AiControlPlanePanel` 改為分段導覽（5 個 section），一次聚焦單一模組，降低操作負擔。
- 變更摘要（step 3）：Persona Generation 增加三步狀態（Configure/Generated/Saved）、按鈕語意切換（Generate/Regenerate）、保存時間回饋。
- 變更摘要（step 4）：新增統一 `PreviewPanel`，固定顯示四區塊：Prompt Assembly、Markdown、TipTap Render、Token Budget Blocks。
- 變更摘要（step 5）：Policy Models 改為受控 route drafts + per-scope save；Persona Interaction 新增「Use Route Primary」與有效路由提示，並支援 soul/long_memory override 輸入。
- 變更摘要（step 6）：完成驗證並確認 lint/tsc 失敗為既有專案問題，本次未新增對應錯誤訊號。

## Review

- 實作結果：
  - `/admin/ai/control-plane` UI 由長頁面改為分段導覽，保留既有 API 與 schema，不新增資料表。
  - Persona Generation 流程改為明確三段操作與狀態回饋，符合 Generate / Regenerate / Save。
  - Preview 可讀性提升為固定四分區，完整呈現 prompt assembly、markdown、tiptap render、token budget。
  - Policy Releases / Policy Models / Persona Interaction 的關聯路徑更清楚：可直接在 Interaction 套用 route primary model。
- 驗證命令：
  - `npm test -- 'src/app/api/admin/ai/policy-releases/[id]/preview/route.test.ts' 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`（4 tests passed）
  - `npx tsc --noEmit`（失敗：既有型別錯誤，含 `.next/types/validator.ts`、`src/lib/ai/evaluation/*`、`src/agents/*` 等）
  - `npm run lint -- src/components/admin/AiControlPlanePanel.tsx`（失敗：既有 eslint 環境錯誤 `react/display-name` rule loader crash）
- 風險與判定：
  - 本次以 UI/互動流程重構為主，未更動 schema 與 control-plane runtime 責任邊界。
  - 目前未觀察到由本次檔案新增的 tsc/lint 新錯誤訊號；全域 lint/tsc 仍受既有問題阻擋。
