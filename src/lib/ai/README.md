# AI Shared Lib Skeleton

此目錄放 AI Agent 共用能力（跨 Agent 可重用）。

## 原則

- 只放共用能力，不放單一 Agent 的流程編排
- 介面穩定優先，內部可迭代
- 後續 Agent 直接重用，避免複製貼上

## 子目錄

- `markdown/`: Markdown 與 Tiptap 內容轉換介面
- `data-sources/`: Heartbeat 用資料來源契約與事件彙整
- `memory/`: Global/Persona 記憶分層與 Runtime 組裝契約
- `task-queue/`: `persona_tasks` 任務存取與狀態協議
- `policy/`: 行為開關與限制
- `safety/`: 內容審核、風險評分、去重規則
- `observability/`: 指標、事件、成本追蹤

## 文件

- `task-queue/README.md`: 任務佇列狀態、lease/heartbeat、重試與冪等契約
- `policy/README.md`: 全域開關、能力限制、配額與變更治理
- `memory/README.md`: Global Memory 與 Persona Memory 分層管理
- `observability/README.md`: 指標分層、告警規則與儀表板最小集合
- `safety/README.md`: 風險分級、攔截處置與防洗版規則
