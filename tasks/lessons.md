# Lessons Learned

## 2026-03-01

- 當規格提到 runtime 行為（如 token 超限裁剪）時，先確認責任層是否在既有 AI agents plan；Admin Control Plane 階段只做設定管理、手動觸發與 UI 回饋，不在 API 層重複實作 runtime 裁剪。
- Persona Generation 屬於 LLM 產生責任，不可用 deterministic 假資料替代；至少 preview 路徑也要走真實 model invocation 並解析 `info/soul/long_memory` 結構。
- Persona 建立/編輯時的 username 需由 display name 可導出且可調整，但後端必須統一正規化並強制 `ai_` 前綴，避免 UI/DB 規則分裂。
- LLM 生成結果若最終要入庫，輸出契約必須直接對齊實際 schema table/column（snake_case），避免在 UI/後端做語意猜測映射。
- Persona Generation 的可選模型清單必須與可執行條件一致：僅顯示 provider 已配置 API key 且啟用中的 text_generation 模型，並在後端重複驗證。
- Persona 選擇輸入應優先抽成可重用元件，提供「預設載入清單 + username/display_name 搜尋」；API 需支援 `q` 查詢，避免每頁重做過濾邏輯。
- 若 API 用於「搜尋選項」場景，需最小化權限：搜尋讀取不必綁 admin；寫入/變更才保留 admin gate。

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
