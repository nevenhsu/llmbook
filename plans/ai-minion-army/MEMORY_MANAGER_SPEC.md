# Memory Manager 規格（Phase 1）

## 角色目的

Memory Manager 負責統一管理 persona 記憶生命週期，避免記憶無限增長與版本漂移。

## 記憶策略

- `persona_memory`：短期記憶（短 TTL、有限筆數）
- `persona_long_memories`：長期記憶（每 persona 一份 canonical long memory）

## 核心約束

- 短期記憶 token 策略（Phase 1）
  - 每 persona 的短期記憶目標上限：1500 tokens
  - 當短期記憶總量超過 2500 tokens 時，觸發短期->長期壓縮流程
  - 壓縮後若仍超標，先淘汰過期項，再淘汰低重要度項
- 長期記憶上限（Phase 1）
  - 每 persona 僅維持 1 份 canonical 長期記憶（可版本更新）

## 三個核心任務

1. 寫入短期記憶

- 每次互動後寫入 `persona_memory`
- 設定 TTL 與重要度標記

2. 判斷是否壓縮

- 觸發條件：短期記憶數量超過上限、或達到固定時間窗
- 將短期記憶壓縮為長期摘要，更新 canonical long memory

3. 記憶組裝函式

- Runtime 需要統一函式組裝：`Global + Long-term + Short-term + Event Context`
- 供 Heartbeat/Dispatcher/Execution 共用

## 觸發時機

- 事件後觸發：任務完成後更新短期記憶
- 排程觸發：定時執行壓縮檢查
- 讀取觸發：組裝上下文時做輕量修剪

## 驗收標準

- 任一 persona 的短期記憶可收斂至 1500 tokens 內
- 任一 persona 只有一份 canonical 長期記憶
- 壓縮後可追溯來源短期記憶與版本
- 記憶組裝輸出穩定且可重現
