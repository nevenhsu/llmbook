# Lessons Learned

## 2026-03-01

- 當規格提到 runtime 行為（如 token 超限裁剪）時，先確認責任層是否在既有 AI agents plan；Admin Control Plane 階段只做設定管理、手動觸發與 UI 回饋，不在 API 層重複實作 runtime 裁剪。
- Persona Generation 屬於 LLM 產生責任，不可用 deterministic 假資料替代；至少 preview 路徑也要走真實 model invocation 並解析 `info/soul/long_memory` 結構。
- Persona 建立/編輯時的 username 需由 display name 可導出且可調整，但後端必須統一正規化並強制 `ai_` 前綴，避免 UI/DB 規則分裂。
- LLM 生成結果若最終要入庫，輸出契約必須直接對齊實際 schema table/column（snake_case），避免在 UI/後端做語意猜測映射。
- Persona Generation 的可選模型清單必須與可執行條件一致：僅顯示 provider 已配置 API key 且啟用中的 text_generation 模型，並在後端重複驗證。
- Persona 選擇輸入應優先抽成可重用元件，提供「預設載入清單 + username/display_name 搜尋」；API 需支援 `q` 查詢，避免每頁重做過濾邏輯。
- 若 API 用於「搜尋選項」場景，需最小化權限：搜尋讀取不必綁 admin；寫入/變更才保留 admin gate。

## 2026-03-02

- 當使用者明確要求「列表優先 + 列表內直接操作」時，不要保留多餘的 Add 按鈕流程；應把主要操作收斂到 list row actions（例如 provider API key 設定）。
- 對於 model 啟用條件，若規格要求「測試通過後才能 active」，必須在 UI 與 hook 同時做 gating（前端提示 + 提交前檢查），避免僅靠顯示狀態。
- 涉及金鑰欄位（如 `apiKey`）時，API response 必須做白名單序列化，防止未來型別變更時意外把敏感欄位回傳前端；只可回 `hasKey` / `keyLast4` 等遮罩資訊。
- 針對可重排清單的管理介面，原生 HTML5 DnD 穩定性不足時應優先採用 `@dnd-kit/sortable`，避免拖拉 drop 命中與排序同步不一致的 bug。
- 當模型選擇邏輯已改為「active + order」，`primary/fallback` 必須改為衍生資料而非手動真實來源，避免雙重真相造成 agent 選模不一致。

## 2026-02-26

- 通用人格規範與 soul schema 不綁單一 domain；資料以 LLM 消費為主時，優先單一 `jsonb`，避免過度版本化與欄位拆分。
- 新 schema 已可完整承載舊資訊時，下一版 migration 直接清掉 legacy 欄位/索引，避免雙軌漂移。
- Provider 與 model 預設值以使用者明確指定為準；xAI 路徑優先採用 Vercel AI SDK（`@ai-sdk/xai`）。
- 若方向已決定遷移到單一框架，移除 legacy compatibility 分支與命名，不保留歷史相容層。
- 環境變數命名定案後，程式與 `.env.example` 同步移除舊別名（例如保留 `XAI_API_KEY`、移除 `GROK_API_KEY`）。
- 路由與 policy 設定以 DB control plane 為主，env 僅做 fallback；`.env.example` 只保留必要鍵。
- 失敗策略維持「空輸出 + skip/熔斷」：禁止 mock 隱式 fallback、禁止 deterministic 假文案開關。
- 規格檢查時必須分開確認「模型路由（Policy Models）」與「政策內容（Global Policy Studio）」，避免只做路由未做政策編輯。
- Token 超限處理優先壓縮 `persona_memory -> persona_long_memory`；若仍超限，必須回傳 UI 提示讓 Admin 精簡 global rules，不可在後端默默削弱全域規範。
- 資料表清單在規格文件中預設視為「邏輯責任模型」；實作時先映射既有 schema，非必要不新增實體表。
- Persona profile 相關資料優先沿用既有 `personas/persona_souls/persona_memory/persona_long_memories`；`persona_engine_config` 視為舊配置來源並由 provider/model 路由表取代。
- 使用 `@dnd-kit` 時，`DndContext` 不能放在 `<table>` 結構內（`thead/tbody` 之間或其子層），因其會渲染 `<div>` 無障礙節點；必須放在表格外層，避免 HTML invalid nesting 與 hydration mismatch。
- 在表格結構中，`<table>` 的直屬子節點只能是 `caption/colgroup/thead/tbody/tfoot/tr`；任何 React context 組件若可能注入 `<div>`（例如 dnd accessibility node）都必須包在 table 外層。
- 當資料模型已升級為顯式欄位（如 `model.displayOrder`）時，UI 排序讀取必須以新欄位為單一真相；舊 `metadata.*` 只能做 fallback，否則拖拉排序會出現「寫入成功但顯示未更新」的假失敗。
- 管理頁若已改為「active model order 為真相」，不要在同一刷新流程再打 `/api/admin/ai/model-routes` 當來源；應由 providers+models 即時計算 routes，否則會出現路由顯示錯誤與不必要的 GET 噪音。
- Model 排序屬於配置管理，不應依賴 provider 是否已填 API key；應先確保 supported providers/models 都有持久化記錄（disabled/untested 也可），將「可排序」與「可調用」完全解耦。
- 路由分類與模型分類不可混用：Model 管理必須以 capability（text/image）為主，互動類型（post/comment/persona）只決定是否調用哪種 capability，不應再建立互動型專屬 model route。
- 使用者明確要求淘汰舊路由語意時，不要保留 `taskRoutes/default` 相容分支；應直接切到新單一真相（capability routes），避免 agent 路由行為仍受舊配置影響。
- 若選模規則定為「active model order」，執行層不可再保留 `primary/fallback` 二元路由；應改為有序 targets 串列，失敗時按序切到下一個 active model。
- 模型 capability 不能只分 text/image 輸出能力，還要額外標記 prompt modality（是否支援 text+image 輸入）；選模時需按請求 modality 過濾，避免把 text-only 模型派到多模態任務。
- 使用者明確要求開發階段不相容舊設定時，文檔必須同步移除 legacy 相容敘述，並明確要求舊 `primary/fallback`、舊 `taskRoutes/default` 直接遷移到新結構。
- 當需求要求「開發階段不相容舊設定」時，除了產品/技術 spec，Agent 入口文件（`AGENTS.md`、`src/agents/README.md`）也必須同步聲明，避免執行層仍保留 legacy 路徑。
- 使用者要求規則「通用化」時，文件不應綁單一子題（例如只寫 routes）；需提升為跨層級規則（runtime config、schema、API contract、policy 結構）並明確禁止雙軌相容。
- 若使用者指出 API 分類邏輯不一致，需從型別層（union/allowed scopes）一併收斂，而不只改 GET 回傳，否則舊 scope 仍可能經由寫入流程殘留。
- 使用者若明確指定 policy 版標格式（例如只要整數 `1,2,3`），UI/API/文件需同步統一；不可沿用語意版號格式避免治理規則分裂。
- 拖拉排序屬於單一使用者動作時，前端不得拆成多次 PATCH + 額外 route PUT；應改為單一 bulk API，後端同次更新排序與衍生 routes，避免請求風暴與多次版本寫入。
- 開發模式（React Strict Mode）會放大初始化副作用；若頁面 on-mount 會自動寫入 DB，後端必須做 idempotent upsert（以 business key 去重）且避免每次小變更新增 release row。
- 當需求指定「舊版本不可更新、只能 rollback」時，前端 selector 必須限制為 current/next，後端也要強制驗證版本範圍，不能只靠 UI 約束。
- 若使用者要求「單一步驟完成 upsert + reorder」，應在同一個後端 API 內做 materialize（補 provider/model）後再排序，避免前端先補資料再排序造成額外請求與競態。
- `Test` 按鈕的禁用條件只能依賴「provider 是否有 API key」，不能依賴 model row 是否已存在；對 supported model 應在測試動作內自動 materialize 後再執行 test，避免 image model 在未建檔狀態永遠不可測。
- Control plane 的 providers/models 讀取與 UI 映射必須做 business-key 去重（providerKey、providerId+modelKey），並在衝突時優先保留 `hasKey=true` 與較新 `updatedAt`，避免重複資料把 key 狀態覆蓋成 missing。
- Provider API key 若由 Admin UI 管理，LLM runtime 與 model test 不可再讀 `.env` 當主來源；需使用共用 server lib 從加密 secrets table 解密注入 provider，確保 control-plane 設定與 agent 執行一致。
- Provider API key 更新後，對應 provider 底下 model 的測試結果不可沿用；必須重置 `testStatus` 與錯誤欄位，避免 UI 顯示舊 key 的 success 並誤導可用性。
- Model test 失敗時若已有 `onProviderError` 的具體錯誤，後續彙總分支不得再覆蓋成泛用訊息（如 `Model test failed`）；需保留原錯誤並更新 `updatedAt`，確保 UI 顯示最新可診斷資訊。
- 錯誤訊息合併時要把空字串視為無效值；若 `event.error` 或 `llmResult.error` 為 `\"\"`，必須改用可診斷 fallback，否則 UI 會退回顯示泛用錯誤造成誤判。
- 供應商回傳的泛用錯誤字串（如 `Model test failed`）不可原樣顯示；要在 server 端嘗試拼接 `status/code/type` 細節，確保 admin 能直接診斷是 key、endpoint 或 model 問題。
- 最小 token 的 provider 健康檢查不應強依賴「文字輸出非空」；只要 provider 回傳無 `error` 且 `finishReason != error` 即視為可用，避免像 MiniMax 這類 `finishReason=length` 但 text 空字串被誤判失敗。
