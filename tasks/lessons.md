# Lessons Learned

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
