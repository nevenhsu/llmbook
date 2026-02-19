# Refactor & Optimization Plan — Overview

> 這份文件是整體重構計劃的入口。  
> 所有子任務文件位於 `plans/refactor/` 目錄下。  
> **請先閱讀本文件，再依優先順序執行各子任務。**

---

## 背景

經過完整的程式碼審查，發現以下類別的問題：

| 類別            | 問題數量 | 影響                    |
| --------------- | -------- | ----------------------- |
| 功能錯誤（Bug） | 3        | 高 — 功能損壞或路由失效 |
| 重複代碼        | 8        | 高 — 維護成本倍增       |
| 架構缺失        | 5        | 中 — 擴展困難           |
| 性能問題        | 5        | 中 — 多餘 DB 查詢       |
| 樣式/CSS Bug    | 3        | 低 — UI 效果失效        |
| 程式碼整潔      | 6        | 低 — 可讀性差           |

---

## 子任務文件索引

| 文件                                                           | 主題                                                    | 優先順序          |
| -------------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| [01-bug-fixes.md](./01-bug-fixes.md)                           | 功能 Bug 修正（通知路徑、prompt 替換）                  | **P0 — 立即執行** |
| [02-api-client-unification.md](./02-api-client-unification.md) | 統一 API 客戶端，移除 30+ 個 raw fetch                  | **P1 — 高優先**   |
| [03-db-query-dedup.md](./03-db-query-dedup.md)                 | 消除重複 Supabase 查詢（Board 頁、Permissions）         | **P1 — 高優先**   |
| [04-shared-lib-extraction.md](./04-shared-lib-extraction.md)   | 提取共享函式（sort-params、POST_STATUS、ranking）       | **P2 — 中優先**   |
| [05-component-refactor.md](./05-component-refactor.md)         | 元件重構（ProfilePostList、FeedContainer、PostActions） | **P2 — 中優先**   |
| [06-tiptap-consolidation.md](./06-tiptap-consolidation.md)     | TipTap 目錄整合、CSS Bug 修正                           | **P3 — 低優先**   |
| [07-code-cleanup.md](./07-code-cleanup.md)                     | 程式碼整潔（imports 順序、console.log、空目錄）         | **P3 — 低優先**   |

---

## 執行原則

1. **依優先順序執行**：P0 → P1 → P2 → P3，不要跳過。
2. **每個子任務獨立提交**：每完成一個子任務開一個 commit，方便回滾。
3. **不改功能，只改結構**：重構期間不新增功能，確保行為不變。
4. **先看文件再動手**：每個子任務文件都有明確的「Before/After」範例，請遵循。
5. **執行後跑測試**：`pnpm test` 確保無迴歸。
6. **有疑問時參考 AGENTS.md**：確認正確的 import 路徑和模式。

---

## 執行狀態追蹤

執行者請在此更新進度：

- [ ] P0 — Bug 修正 (`01-bug-fixes.md`)
- [ ] P1a — API 客戶端統一 (`02-api-client-unification.md`)
- [ ] P1b — DB 查詢去重 (`03-db-query-dedup.md`)
- [ ] P2a — 共享函式提取 (`04-shared-lib-extraction.md`)
- [ ] P2b — 元件重構 (`05-component-refactor.md`)
- [ ] P3a — TipTap 整合 (`06-tiptap-consolidation.md`)
- [ ] P3b — 程式碼整潔 (`07-code-cleanup.md`)
