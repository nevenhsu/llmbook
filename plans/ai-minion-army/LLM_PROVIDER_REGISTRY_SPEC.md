# LLM Provider Registry & Tool Abstraction (借鑑 Nanobot)

本規格定義如何管理多種 LLM 供應商，以及如何讓工具呼叫標準化，以提高系統的擴充性與成本控制能力。此設計深度借鑑了開源框架 [Nanobot](https://github.com/HKUDS/nanobot) 的核心理念，但在 TypeScript/Next.js 環境下實作。

## 1. 核心目標

- **多模型無縫切換**：不能將特定的 LLM API (如 OpenAI 或 Gemini) 寫死在 Agent 邏輯中。
- **統一的呼叫介面**：所有 Agent 都透過統一的介面發出請求，底層自動處理 API 金鑰、重試與超時。
- **Token 與成本攔截**：所有 LLM 呼叫必須經過 Registry，以便精準計算 Token 用量並更新 `persona_llm_usage`。
- **為 MCP 鋪路**：工具 (Tools) 呼叫的介面設計需預留擴充性，未來可平滑升級為標準的 Model Context Protocol (MCP)。

## 2. 架構設計 (Provider Registry)

建議在 `src/lib/ai/llm/` 實作 Registry 模式：

### 介面定義 (TypeScript 概念)

```typescript
// 所有 Provider 必須實作此介面
interface LLMProvider {
  id: string; // e.g., 'openai', 'gemini', 'anthropic'
  generateText(prompt: string, options?: GenerationOptions): Promise<GenerationResult>;
  // ... 其他方法如 generateImage, embedding 等
}

// 註冊表單例
class ProviderRegistry {
  register(provider: LLMProvider): void;
  getProvider(id: string): LLMProvider;
  getDefaultProvider(): LLMProvider;
}
```

### 呼叫流程

1. **設定讀取**：Policy Manager 或 Cost Guard 決定當前任務應使用的模型 (例如：日常對話用 `gemini-flash`，高難度決策用 `openai-gpt4o`)。
2. **獲取 Provider**：Execution Agent 透過 `ProviderRegistry.getProvider('gemini')` 取得實體。
3. **執行呼叫**：Agent 呼叫 `generateText`，底層封裝自動處理網路請求。
4. **成本記錄**：底層在回傳結果前，自動擷取 API Response 中的 Token Usage，寫入資料庫。

## 3. 架構設計 (Tool Abstraction & MCP Readiness)

借鑑 Nanobot 的理念，Agent 需要具備操作外部環境的能力 (例如讀取文章、寫入資料)。

### 原則

- Agent 的 Prompt 中，定義可用的工具清單 (JSON Schema 格式)。
- 這些工具的實際執行邏輯 (如 `fetch_post_context`, `update_memory`) 註冊在統一的 Tool Registry 中。
- 當 LLM 回傳需要呼叫工具的指令時，系統攔截該指令，執行對應的 TypeScript 函數，並將結果餵回給 LLM。

### 與 Phase 1 的結合

- **初期**：我們先手刻幾個核心工具介面 (如 `getGlobalMemory()`) 供 Agent 使用。
- **未來**：當我們需要整合更複雜的外部服務時，可以直接將這些介面升級為相容 MCP 的 Server，而不需要改寫 Agent 的核心推理邏輯。

## 4. 驗收標準

- [ ] 新增任何新的 LLM 供應商時，不需要修改 Agent (如 Task Dispatcher 或 Execution Agent) 的程式碼。
- [ ] 所有的 LLM 呼叫都會自動留下 Token 消耗與成本紀錄。
- [ ] 支援在資料庫 (`persona_engine_config`) 動態切換預設的模型供應商。
