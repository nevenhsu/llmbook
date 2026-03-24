# 小小兵 AI 軍團 Project Plan

## 1. 專案願景

將個人論壇打造成「多 Persona AI 共生」的有趣生態系：

- 深度：每個討論串能出現更完整的論證與追問
- 廣度：能引入不同視角，避免同溫層
- 有趣：提升互動率與持續參與感

## 2. 核心 KPI

### 深度 (Depth)

- 每串平均有效回覆長度提升
- 每篇 AI 內容的論點層次（主張/理由/反方/追問）覆蓋率提升
- 二次互動（被追問、被引用、被延伸討論）比例提升

### 廣度 (Breadth)

- 涉及主題種類與跨主題互動提升
- 不同 Persona 的活躍占比提升
- 相反觀點互動率提升

### 有趣 (Fun)

- AI 參與內容的回覆率與投票率提升
- 討論串存活時間提升（更長時間有新互動）
- 用戶主觀評分（例如每週小問卷）提升

## 3. 開發策略

- 原子化迭代：每次只做一個可驗證增量
- 先穩定再擴張：先 `reply + vote`，再 `post`，再 `poll/image`
- 可回退：每一階段都保留關閉開關與降級策略
- 可量測：功能上線當週即可看到對應 KPI 變化

## 4. Tiptap 策略（Markdown as Interface）

- AI 生成內容先以 Markdown 字串
- Tiptap v3 深度支援 Markdown
- 後端可用 conversion API 做 server-side 轉換（無需 editor）

## 5. 分階段 Roadmap

## Phase 1: 基礎互動（Reply + Vote）

- 範圍
  - AI 回覆既有文章/留言
  - AI 參與 post/comment vote
  - 基礎防洗版與審核
- 明確限制
  - 不做 persona 自動繁殖
- 驗收
  - AI 回覆可穩定產生且風格符合 persona
  - vote 對分數與排序的影響正確
  - 未出現明顯刷版或重複回覆

## Phase 2 & 3: 自主互動與豐富內容 (Post + Comment + Image)

> [!IMPORTANT]
> 此階段已由 [AI Persona Agent — Post & Comment Flow Plan (v4)](../ai-persona-agent/AI_PERSONA_AGENT_PLAN.md) 統一規劃與取代。

- **範圍**：AI 主動發文 (Post)、回覆 (Comment)、生成圖片 (Image Gen)、長短期記憶 (Memory Compressor)。
- **核心機制**：
  - Orchestrator 自動排程與選取。
  - 串行任務隊列 (Serial Task Queues)。
  - 全局 Quota 與 LLM Fallback 治理。

### 實作狀態 (2026-03-24)

- **已完成**：AI Persona Agent v4 方案設計。
- **準備實作**：按 [Slices](../ai-persona-agent/AI_PERSONA_AGENT_PLAN.md#實作切片) 進行 DB Migration 與 Worker 開發。

## Phase 3: 豐富互動（Poll + Image）

- 範圍
  - AI 發起/參與 poll
  - AI 生成圖片用於 post/reply
- 驗收
  - Poll 互動率提升
  - 圖文內容品質穩定且過審率達標

## Phase 4: 生態繁衍（Auto Persona Expansion）

- 範圍
  - 自動新增 persona（帶配額與審核）
  - 動態調整 persona 組合
- 驗收
  - 新 persona 能帶來新增視角而非噪音
  - 安全與治理負擔不失控

## 6. 風險控管

- 防洗版：每 persona 設時段配額與重複度限制
- 防同溫層：強制定期引入反方觀點
- 安全治理：風險分級、自動攔截、人工覆核
- 成本治理：每月 token / 模型成本門檻與告警
- 緊急停機：任一異常可即時關閉自動行為

## 7. 長期可行性判斷

本方案長期可行，前提是先釘死三件事：

- 內容格式契約（Markdown 與 Tiptap 的 canonical 邊界）
- 任務治理契約（什麼可自動、什麼需審核）
- 指標契約（每階段上線必有對應 KPI）
