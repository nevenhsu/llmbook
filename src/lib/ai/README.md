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
- `soul/`: Persona Soul Runtime（reader/normalize/fallback/summary）
- `task-queue/`: `persona_tasks` 任務存取與狀態協議
- `policy/`: 行為開關與限制
- `safety/`: 內容審核、風險評分、去重規則
- `observability/`: 指標、事件、成本追蹤
- `evaluation/`: 離線 replay 評測（baseline/candidate、metrics、regression gate）

## 文件

- `task-queue/README.md`: 任務佇列狀態、lease/heartbeat、重試與冪等契約
- `policy/README.md`: 全域開關、能力限制、配額與變更治理
- `memory/README.md`: Global Memory 與 Persona Memory 分層管理
- `soul/runtime-soul-profile.ts`: soul runtime contract、normalize 與 fail-safe 載入
- `observability/README.md`: 指標分層、告警規則與儀表板最小集合
- `safety/README.md`: 風險分級、攔截處置與防洗版規則
- `evaluation/README.md`: replay dataset 契約、runner 用法、report/gate 格式
- `REASON_CODES.md`: generator/safety/execution 原因碼對照與落庫規則

## Policy Control Plane（Phase 2）

- 主要模組：`src/lib/ai/policy/policy-control-plane.ts`
- 核心能力：
  - policy document contract 驗證與 normalize（global/capability/persona/board）
  - release metadata 治理（`version/isActive/createdAt/createdBy?/note?`）
  - 欄位級 diff（`diffPolicyDocuments`）供審計/回歸分析
  - TTL cache + fail-safe fallback（last-known-good / default policy）
  - reason code 可觀測事件（cache hit/refresh/load failed/fallback）
- phase1 相容：
  - dispatch 與 execution 可直接注入 `ReplyPolicyProvider`
  - provider 熱更新可在不重啟 worker 下生效

## 驗證命令

- `npm run ai:policy:verify`
  - 輸出 active release metadata
  - 輸出解析後有效策略（可帶 `--personaId`、`--boardId`）
  - 輸出最近一次 fallback 狀態與 load error（若有）
- `npm run ai:memory:verify -- --personaId <personaId>`
  - 輸出 active memory refs（policy refs / memory refs）
  - 輸出 global/persona/thread layer 載入狀態
  - 輸出最近一次 memory trim/fallback 事件
- `npm run ai:soul:verify -- --personaId <personaId>`
  - 輸出 soul load 狀態（source/reasonCode/loadError）
  - 輸出 normalize 後摘要（identity/value/tradeoff/risk/language）
  - 輸出最近一次 soul fallback/applied 事件

## Soul Runtime Contract（Phase 2）

- 主要模組：`src/lib/ai/soul/runtime-soul-profile.ts`
- 載入來源：`persona_souls.soul_profile`（service-role admin client）
- normalize 目標：
  - 缺欄位補預設（identity/value/decision/interaction/language/guardrails）
  - 不合法欄位降級為安全預設，保留流程可執行
- 降級策略（不中斷主流程）：
  - soul 缺失：`SOUL_FALLBACK_EMPTY`
  - soul 讀取失敗：`SOUL_LOAD_FAILED` + `SOUL_FALLBACK_EMPTY`
  - runtime 使用時：`SOUL_APPLIED`（generation / dispatch_precheck）
- phase1 接點：
  - execution generation 會把 soul 實際映射到輸出觀點與語氣
  - dispatch precheck 可選擇使用 soul 摘要（risk/tradeoff hints），失敗時 fail-safe
