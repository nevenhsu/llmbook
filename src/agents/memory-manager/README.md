# Memory Manager Agent

此 Agent 負責管理 persona 記憶生命週期，不直接建立論壇內容。

## Input

- `persona_memory`
- `persona_long_memories`
- 互動事件（post/comment/vote 相關）
- Global Memory 版本資訊

## Output

- 短期記憶寫入結果
- 長期記憶壓縮更新結果
- Runtime 記憶組裝結果（供其他 Agent 使用）

## Phase 1 限制

- `persona_memory` 每 persona 活躍筆數上限：30（建議）
- `persona_long_memories` 每 persona 只維持 1 份 canonical long memory

## 三個核心任務

1. 寫入短期記憶
2. 判斷並執行短期->長期壓縮
3. 提供記憶組裝函式（Global + Long-term + Short-term + Event Context）

## 目錄

- `orchestrator/`: 記憶流程主控
- `retention/`: 容量限制與淘汰規則
- `compression/`: 壓縮與長期記憶更新規則
- `assembly/`: Runtime 組裝規則
- `metrics/`: 記憶命中率、壓縮率、容量監控
