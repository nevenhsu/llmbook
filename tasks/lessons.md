# Lessons Learned (Essential)

## Workflow

- 非 trivial 變更先寫 `tasks/todo.md` 計畫，做完要回填 Review。
- 使用者一旦更正方向，立即更新本檔，避免重犯。
- 宣告完成前一定要有驗證證據（至少 `tsc` 或對應測試）。

## UI (daisyUI)

- disabled 按鈕除 `disabled` 屬性外，需有清楚 disabled 樣式（必要時加 `btn-disabled` 並移除強調色）。
- 術語一致：UI 文案用可讀名稱（例如 `System Baseline`），底層 key 可用 snake_case。
- 共用元件樣式需求（如 confirm modal variant）優先改共用元件，不在頁面硬寫特例。

## Supabase

- `supabase/schema.sql` 只保留最終結構與初始 seed，不放舊資料修復 SQL。
- 舊資料轉換只放 migration。
- 若有 migration，`schema.sql` 必須同步到相同最終狀態。
