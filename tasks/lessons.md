# Lessons Learned

## 2026-02-26

- 使用者修正：Soul 規則內容不應帶入特定領域（如作品/敘事）偏向。
- 防呆規則：在定義「通用人格規範」時，schema 名稱與欄位不得綁定單一 domain；若需要舉例，必須同時提供通用任務示例，避免規格被誤解為專案限定。
- 使用者修正：Soul schema 欄位需要簡化，避免過度拆分。
- 防呆規則：若結構會持續演進，優先用單一 `jsonb` 結構欄位 + `schema_version`，先追求相容與可迭代，再視查詢需求拆欄。
- 使用者修正：確認可收斂後應直接移除冗餘舊欄位。
- 防呆規則：當新 schema 已可完整承載舊資訊，優先在下一版 migration 直接 drop legacy 欄位與依賴索引，避免雙軌長期漂移。
- 使用者修正：LLM 使用的 soul 結構可容忍小幅變動，不需額外 schema version 欄位。
- 防呆規則：若資料主要給 LLM 消費且無強機器契約需求，優先精簡為單一 `jsonb` 主欄位，避免過早版本化。
- 使用者修正：Provider 預設模型應為 `grok-4-1-fast-reasoning`，且 xAI provider 優先採用 Vercel AI SDK（`@ai-sdk/xai`）。
- 防呆規則：涉及 provider/model 預設值時，先以使用者指定型號為準；若規格文件已指向特定 SDK，實作應優先貼齊官方 SDK 路徑，而非自建 HTTP 呼叫。
- 使用者修正：已決定改用 SDK 框架時，不需要保留舊相容層。
- 防呆規則：若產品方向已明確遷移到單一框架，應移除 legacy compatibility 分支與命名，避免雙軌維護成本。
- 使用者修正：xAI 金鑰命名統一使用 `XAI_API_KEY`，不保留 `GROK_API_KEY`。
- 防呆規則：當環境變數命名策略已定案，程式與 `.env.example` 必須同步移除舊別名，避免雙鍵並存造成配置歧義。
- 使用者修正：`AI_REPLY_*` 已改由 DB policy 管理，不應再放在 `.env.example`。
- 防呆規則：當配置來源已遷移到 control plane，`.env.example` 只保留必要鍵；僅 fallback/override 的鍵改放文件說明，不作預設暴露。
- 使用者修正：`AI_MODEL_*` 應作 fallback，主要路由改由 DB 管理。
- 防呆規則：對 runtime 路由設定，優先查 DB control plane，再回退 env；避免把 env 當主配置來源。
- 使用者修正：不要預設假 fallback（mock）；LLM 不可用時應暫停執行而非產生替代內容。
- 防呆規則：在 production-like runtime，測試用 provider 不得作為隱式預設 fallback；失敗預設應可觀測且可被上游 skip。
- 使用者修正：`AI_REPLY_DETERMINISTIC_FALLBACK_ENABLED` 不需要，失敗就失敗，不要假文案。
- 防呆規則：當失敗策略已定義為「空輸出 + skip/熔斷」，不得再保留可開關的 deterministic copy 路徑或相關 env。
