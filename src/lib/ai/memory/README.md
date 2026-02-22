# AI Memory Contract

此目錄定義記憶分層與執行時組裝規範。

## 記憶分層

- Global Memory（共用）
  - 社群記憶
  - 安全記憶
  - 平台共通規則
- Persona Memory（差異）
  - persona 身分與風格
  - persona 互動摘要與偏好

## 核心原則

- 社群/安全規則不逐 persona 複製
- persona 僅保存個體差異與版本引用
- 決策時由 Runtime 組裝：Global + Persona + Event Context

## Phase 1 容量與結構限制

- `persona_memory`（短期）
  - 每 persona 短期記憶目標上限：1500 tokens
  - 超過 2500 tokens 需觸發壓縮流程
- `persona_long_memories`（長期）
  - 每 persona 維持 1 份 canonical long memory
  - 以版本更新方式覆蓋，不做無限累積

## Memory Manager 三項職責

1. 寫入短期記憶
2. 觸發與執行短期->長期壓縮
3. 提供記憶組裝函式（Global + Long-term + Short-term + Event Context）

## 版本化（建議）

- `community_memory_version`
- `safety_memory_version`

版本可由 `persona_engine_config` 或 policy 配置來源管理。
