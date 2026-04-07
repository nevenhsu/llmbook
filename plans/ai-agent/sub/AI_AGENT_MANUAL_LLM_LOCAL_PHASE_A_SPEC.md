# Manual LLM（終端機人工貼上）— 本機 Phase A 除錯規格

## 0. 名詞簡解（問答）

### 0.1 Recorder 是什麼？

專案內的 **`PromptRuntimeEventRecorder`**（見 `src/lib/ai/prompt-runtime/runtime-events.ts`）用來記錄 prompt／model／**provider** 等階層的**執行事件**（例如呼叫、重試、fallback），可接上 **sink** 寫入記憶體或觀測用儲存。與「終端機印出給人看」是不同條線。

**決議（本方案）：** 第一版以 **終端機 `print` 可見資料**為主；**不**把「手動貼上流程」擴成必須寫 Recorder／DB 的額外規格。若 API 路徑原有 `recorder.record` 行為，manual 分支可**跳過 provider 層事件**或僅發極簡標記—由實作 PR 決定，**不阻塞**手動流程。

### 0.2 EOF 是什麼？

**EOF**（End-Of-File）表示「輸入結束」。在常見 **Unix／macOS 終端機**對 **stdin** 而言，多為 **`Ctrl-D`**（一次或兩次，依終端機而定）。**Windows** 語意較不統一，故規格仍以**明確結束行字面量**（§4.2）為主，EOF 為**可選**輔助。

---

## 1. 目的與範圍

### 1.1 目標

在**本機**、於同一 Node 行程內凡經 **`invokeLLM`** 的文字 LLM 呼叫，在開關啟用時改為終端機 **copy / paste** 流程（典型場景含 `npm run ai:phase-a:once`，但**開關語意為全域**，見 §1.2）。

1. 終端機印出當次呼叫的 **prompt**（與足夠的識別資訊）；
2. 操作者將 prompt 複製到**網頁端 LLM**（或其他介面）取得回應；
3. 將**網頁端回傳的純文字**（assistant response）貼回終端機；下游沿用既有 **`extractJsonFromText`**、`parse` / `validateDeterministic` / repair 等邏輯。

**正式 runtime**（長駐 orchestrator / 其他自動排程）**不得**在未明確啟用的情況下進入此模式；預設仍走 `invokeLLM` + DB/API key。

### 1.2 `AI_AGENT_MANUAL_LLM`（**全域**文字 LLM 流程）

- **變數名：** `AI_AGENT_MANUAL_LLM`
- **啟用寫法（規範）：** `AI_AGENT_MANUAL_LLM=true`
- **語意（決議）：** 同一 process 內，所有走 **`invokeLLM`** 的**文字**呼叫一律進入 **manual copy/paste** 管線（intake、Admin、`LlmRuntimeAdapter` → `invokeLLM` 等）；**不**僅限 Phase A。
- **未設定或非 true：** 走既有 API 路徑（provider secret / routing）。
- **嚴禁：** 在 `AI_AGENT_MANUAL_LLM=true` 時**自動退回 API**（見 §2.3、§4.3）。

### 1.3 非目標（第一版可刻意不做）

- **錄製／重播檔**、或除終端機外的第二套「重送快取」—**不需要**；僅 **print 到終端**供複製貼上即可（決議）。
- 取代正式環境的 provider routing、計費；**不**把 manual 流程綁死為必須擴充 **Recorder／DB 審計**（§0.1）。
- 在瀏覽器內嵌「貼上區」；本規格以 **TTY / stdin·stdout** 為主。
- 保證與任一網頁 LLM 的輸出格式 100% 相容（仍靠既有 `extractJsonFromText` 與 repair 階段收斂）。

---

## 2. 現況與掛載點

### 2.1 程式路徑

- `ai:phase-a:once` → `AiAgentLocalPhaseARunnerService` → `AiAgentOrchestratorPhaseService` → `AiAgentOpportunityPipelineService`。
- LLM 集中在 `AiAgentIntakeStageLlmService`：透過依賴 `invokeStage(input: StageInvokeInput) => Promise<InvokeLlmOutput>` 呼叫底層。

### 2.2 掛載策略（決議）

- **`invokeLLM` 僅作薄層 dispatch**：在解析 registry、走 provider **之前**，若 `AI_AGENT_MANUAL_LLM=true` **且** `stdin` 為 TTY，則將本次呼叫交給 **獨立 manual 模組**（見 §2.3）；否則走既有 API 鏈。
- **若 `AI_AGENT_MANUAL_LLM=true` 但非 TTY：** **throw / fail fast**，**不得**自動改走 API（決議 §1.2）。
- **治理：** 不在生產啟動指令中設定 `AI_AGENT_MANUAL_LLM=true`；開啟時須認知**同一 process 內所有 `invokeLLM`（含 Admin、worker）**皆為貼上模式—通常以**獨立終端機只跑腳本**、Next dev **不設**此 env 規避。

### 2.3 架構：獨立 manual 模組 + 全域佇列（決議）

**目標：** 終端機讀寫、序號、BEGIN/END、**無 timeout 等待貼上**等，**不**塞滿 `invoke-llm.ts` 主流程；`invokeLLM` 只負責判斷 env + 轉發。

**建議模組（路徑僅示例）：** 例如 `src/lib/ai/llm/manual-stdio-queue.ts`（或 `manual-llm/` 目錄），職責包含：

1. **全域單一佇列（queue）**  
   所有 manual 請求 **FIFO 串行**；同一 process 僅一條 stdin 消費線，避免併發互搶。後進者 `invokeLLM` 在 enqueue 處 await，直到前一則貼上完成。
2. **輸出** §4.1 之元資料、`metadata._m`（若有）、`BEGIN`/`END`、操作提示；內文僅來自 **`buildLlmPrompt`（單一函式，§4.1（2））**。
3. **輸入** 讀取操作者貼上的**純文字**（網頁 LLM 的 response），直到約定結束符或 EOF（§4.2）。  
   **Timeout（決議）：** manual 路徑 **忽略** `invokeLLM` 的 `timeoutMs`（以及對遠端重試語意上的 `retries`）；**無上限等待**貼上，直到管理員完成 copy/paste 並送出結束協定。

**終端互動實作（決議）：** 採用 `@inquirer/prompts` 處理互動輸入；manual 模組統一封裝 `Inquirer` 讀取流程，`invokeLLM` 僅 dispatch，不直接操作 stdin 細節。

**API 路徑不變：** 未開 env 時，`invokeLLM` 仍使用既有 `timeoutMs` / `retries` / provider 鏈。

#### 2.3.1 仍以 `invokeLLM` 為全域匯流點

盤點：**文字** LLM 主要皆已匯入 **`invokeLLM`**（intake、Admin、`LlmRuntimeAdapter` 等）。無需在多處複製 manual 邏輯；僅在 **`invokeLLM` 開頭**呼叫 manual 模組或進入 API 分支。

#### 2.3.2 不在「全域文字閘道」內的項目

- **`generateImage`** 等非 `invokeLLM` 路徑：**不涵蓋**。
- **Tool loop / 多輪 tool**：`modelInput.tools` 非空時第一版 **fail fast**（錯誤碼如 `MANUAL_LLM_TOOLS_NOT_SUPPORTED`）。

#### 2.3.3 與 intake / 測試

- Intake 的 `invokeStage` 仍只組 `invokeLLM` 參數；可選在 **`modelInput.metadata._m`** 帶標頭用 props（§4.1）。
- 單元測試對 manual 模組 inject **Readable/Writable** 或 mock queue，**不依賴**真 TTY；CI 不設 `AI_AGENT_MANUAL_LLM`。

### 2.4 範圍外（決議：不開發寫入控制）

- **本功能不包含** Phase A／Supabase **寫入開關**（無 env、無於 `ai:phase-a` 腳本層新增 persist 選項之規格義務）。管線是否寫庫維持**現有程式**行為；若日後要改 DB 寫入策略，屬**另案**，與 `AI_AGENT_MANUAL_LLM` 無關。

---

## 3. 單次 Phase A 會觸發幾次「貼上」？

理解成本關鍵在 `runJsonStage`：**每一次 `invokeStage` 都是一輪「印 prompt → 貼回」**（若採一對一對應）。

### 3.1 `runJsonStage` 內部階段（`StagePhase`）

對**同一個** JSON stage（opportunities 或 candidates），成功路徑至少包含：

1. **`main`** — 主 prompt，產出頂層 JSON（opportunities：`scores`；candidates：`speaker_candidates`）。
2. **`quality_audit`** — 稽核用另一個 prompt；輸出需可 `parseAuditResult`。

失敗或邊界時可能還有：

3. **`schema_repair`** — 至多 `MAX_SCHEMA_REPAIR_ATTEMPTS`（目前為 1）次。
4. **`quality_repair`** — 至多 `MAX_QUALITY_REPAIR_ATTEMPTS`（目前為 1）次。

因此：**單一 batch 的單一 `runJsonStage`，順利時約 2 次 invoke（main + audit）；不順利時最多可到 4 次**（main → schema_repair → audit → quality_repair，實際組合依驗證結果而定）。

### 3.2 Batch 與子集重試

- `scoreOpportunities` / `selectPublicSpeakerCandidates` 以 `MAX_STAGE_BATCH_SIZE`（目前 **10**）分 chunk。
- 缺 key 時另有 **subset 重試**（`MAX_SUBSET_REPAIR_ATTEMPTS`），會對**缺漏子集**再跑一輪（含其內部多次 `invokeStage`）。

### 3.3 Phase A 兩條 flow

`runPhase()` 會先跑 **public** 再跑 **notification** 管線；兩條都會觸發 scoring；public 另含 candidate 選擇。  
**總貼上次數 =（各 batch 的 invoke 次數加總）**，資料量大時會是**很多輪**，操作者需有預期。

### 3.4 產品化取捨（與 2.3 對齊）

| 選項                             | 說明                                                                | 與正式行為差異                                           |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| **完整手動（預設，與決議一致）** | 經統一抽象，**每一個** `invokeStage`（含 audit / repair）都人工貼上 | 與正式「每步都問模型」一致，最累                         |
| **手動僅 main（不推薦為預設）**  | audit / repair 仍走 API                                             | 省次數；**與「全程無 key」目標衝突**，僅可作**另設旗標** |
| **手動 + 跳過 audit**            | 改 pipeline 略過階段                                                | 與正式不一致；需獨立旗標 + **WARN**                      |
| **錄製 / 重播**                  | `(promptHash → response)` 快取                                      | 適合重複除錯                                             |

**決議：** 以 **完整手動** 為 `AI_AGENT_MANUAL_LLM=true` 的預設語意；其餘捷徑若實作須明確命名 env 並在啟動時印 **WARN**。

---

## 4. 終端機協定（stdin / stdout）

### 4.1 輸出內容（每次 invoke 前）

每一輪依序輸出（順序建議固定，方便眼睛掃描與工具解析）：

**（1）元資料區（不含 prompt 本文）**  
單行 JSON 或逐行 key:value，至少包含：

- `invokeId`（由 manual 模組／queue 單調遞增）
- `entityId`
- `taskType`（若 `invokeLLM` 有傳）
- `maxOutputTokens` / `temperature`（僅提示用；manual **不**以此逾時）

**（1b）可選標頭 props：`modelInput.metadata._m`（決議，短 key）**

- **放置位置：** `modelInput.metadata` 下的**可選**鍵 **`_m`**（manual metadata 縮寫）。與既有 `metadata` 其他鍵（如 `entityId`、`taskType`）並存；**不**覆寫既有語意鍵，**不**要求一定有此欄。
- **內容：** 僅供終端機**人讀**標頭，例如：
  - `stageName`：`opportunities` | `candidates`
  - `phase`：`main` | `schema_repair` | `quality_audit` | `quality_repair`
  - `scope`：例如 `stage_audit:opportunities`（用於標頭分類與搜尋，不影響模型契約）
  - `outputKey`：例如 `scores`（與程式內 parsed output key 對齊，便於除錯）
  - 其他字串鍵值可擴充，**不**影響模型契約。
- **未傳時：** 標頭只印 §4.1（1）既有欄位即可。
- **flow 回補（決議）：** manual 模組回傳 `InvokeLlmOutput` 時，保留原 metadata 並回補 `_m`、`invokeId`、`mode: "manual"` 等欄位供後續流程讀取。

**（2）Prompt 本文：統一 `buildLlmPrompt`（決議）**

- `BEGIN`/`END` 之間印出的字串必須來自專案內**單一**函式（`buildLlmPrompt(modelInput)`），規則需與 API 路徑實際送進 provider 的拼接一致（避免「貼去網頁的」與「API 真餵的」語意不一致）。
- **不**另維護第二套「僅供終端列印」的 prompt 字串；呼叫端不需要再傳一份重複的列印專用 prompt。

操作者複製時**只取兩行邊界之間**（含換行與程式碼塊均可）：

```text
<<<AI_AGENT_MANUAL_LLM_PROMPT_BEGIN>>>
（此處為 buildLlmPrompt(modelInput) 的完整輸出）
<<<AI_AGENT_MANUAL_LLM_PROMPT_END>>>
```

- 上述兩行為**字面量**（實作時定為常數）。
- 若合成後正文含相同字面量則偵測並 throw（極罕見）。

- **prompt 檔案輸出（決議）：** manual 模組每次呼叫自動將該段字串寫入 `/logs/manual-prompts/`，並以**時間戳檔名**建立新檔（不覆蓋）。
  - 建議檔名：`prompt-YYYYMMDD-HHmmss-SSS-<invokeId>.txt`
  - 可選再額外維護一個 `latest.txt` 供快速開啟（非必要）。
  - 目的：保留每次呼叫痕跡，方便回看與複製；終端機仍保留 BEGIN/END 輸出。

**（3）操作提示（緊接 END 之後，英文）**

Save location: `/logs/manual-prompts/prompt-YYYYMMDD-HHmmss-SSS-<invokeId>.txt`

Please copy the Prompt above and paste it into a web LLM (e.g., ChatGPT / Claude).
Then paste the **plain-text response** you get back below.
When finished, type this on a new line:
`<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>`
Or press `Ctrl-D` on an empty line to end input (EOF).

### 4.2 輸入內容（操作者貼回）

- **契約（決議）：** 操作者只貼上**從其他網頁 LLM 取得的 assistant 純文字 response**（可含該頁產生的 markdown、程式碼围栏等）；**不**假設另有二進位或專用格式。下游仍以 **`extractJsonFromText`** 從該字串抽出 JSON（裸 JSON、Markdown json 围栏、或雜訊中的 `{...}` 等）。
- **結束輸入（與 prompt 邊界區分）**
  - 貼完 response 後，單獨一行結束字面量（寫死）：`<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>`；並在 §4.1（3）每次提示。
  - 可另支援 **EOF（§0.2，如 Ctrl-D）** 結束；與結束行並存時優先順序由實作註明。
- **等待行為：** 在收到結束符或 EOF 之前 **無 timeout**（決議 §2.3），一律等待管理員貼完。

| 協定          | 描述                       | 適用                            |
| ------------- | -------------------------- | ------------------------------- |
| **A. 結束行** | 貼上後最後一行為約定字面量 | Windows / Cursor 整合終端機較穩 |
| **B. EOF**    | Ctrl-D 結束                | 熟 POSIX 者                     |

### 4.3 TTY、非互動與**禁止退回 API**

- 若 `AI_AGENT_MANUAL_LLM=true` 且 `!process.stdin.isTTY`：**throw / fail fast**；**不得**改走 API（決議）。
- 避免 CI 在誤設 env 時靜默成功或改走線上模型。
- `npm run` 與 TTY 行為需實測；必要時建議以互動式終端機直接跑 `script:run`。

### 4.4 `InvokeLlmOutput` 欄位

手動模式需回傳與 `invokeLLM` 相容的結構，至少：

- `text`：貼上的原始字串（供 parse / repair）
- `finishReason`: `"stop"`（除非要模擬 error）
- `usage`：可填 **0** 或標記 `manual` 的 placeholder（若下游有依賴需查證）
- `providerId` / `modelId`：建議固定為 `manual` / `manual-paste` 以利日誌辨識

---

## 5. 安全與治理

- **Prompt 可能含使用者內容、板塊文字等**：貼到第三方網頁 LLM 即屬**資料外送**，文件需明列風險；建議僅用**測試資料**或已脫敏環境。
- **不要在 log 中再印 API key**（手動模式本身不依賴 key，但仍避免在 debug 中混入 env）。
- **誤用在 production**：嚴禁在正式環境設 `AI_AGENT_MANUAL_LLM=true`。開啟時為**全域**：同一 process 若同時跑 Next Admin，該 process 內之 `invokeLLM` 亦會變貼上模式—**務必**以獨立終端機／獨立 script 行程使用本開關。

---

## 6. 與既有契約的關係

- Intake JSON 形狀與 repair prompt 建構方式，須遵守 [LLM JSON Stage Contract](../../../docs/dev-guidelines/08-llm-json-stage-contract.md) 所描述的分階段語意（若該文有列機讀 schema，手動貼上仍須滿足 `parse*` / `validateDeterministic`）。
- 手動模式**不改**頂層 JSON 欄位約定（例如 opportunities 使用 `scores` 陣列、`opportunity_key` / `probability`）。
- 終端機與 API **共用** **`buildLlmPrompt(modelInput)`** 作為送模／複製用的唯一全文來源（§4.1（2））。

---

## 7. 測試策略

| 層級         | 建議                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| **單元**     | manual **queue 模組**以 inject `Readable`/`Writable` 測試讀寫與 FIFO；`invokeLLM` dispatch 分支可 mock 該模組。 |
| **整合**     | `AiAgentIntakeStageLlmService` 仍可對 `invokeStage` 注入 mock；覆實路徑則測 `invokeLLM` + manual queue。        |
| **E2E 手動** | 互動終端機跑 `ai:phase-a:once:manual`（或等價），小資料集跑通一輪 main+audit。                                  |

`Inquirer` 使用原則：僅用於收集貼上文字與結束動作，不在 manual 流程加入額外多步問答，避免拖慢每輪 LLM 手動回填。

---

## 8. 實作檢查清單（供開發 PR 對照）

- [ ] `AI_AGENT_MANUAL_LLM=true` 時，**全域**所有 **`invokeLLM`** 文字呼叫走 manual（同一 process）。
- [ ] **`invokeLLM` 內不**實作厚重終端機邏輯：轉發至**獨立 manual 模組**，內含 **FIFO queue** 串行化。
- [ ] manual 路徑 **忽略 timeout**（與遠端 `retries` 語意），**無上限**等貼上直至結束符／EOF。
- [ ] manual 啟用且非 TTY：**fail**；**禁止**自動退回 API。
- [ ] 可選 **`modelInput.metadata._m`** 印於標頭；可用 `scope` 例如 `stage_audit:opportunities`。
- [ ] Prompt 區僅用 **`buildLlmPrompt(modelInput)`**，無第二套列印字串。
- [ ] 標頭含 `invokeId`；prompt 區含 `<<<AI_AGENT_MANUAL_LLM_PROMPT_BEGIN>>>` / `<<<AI_AGENT_MANUAL_LLM_PROMPT_END>>>`。
- [ ] prompt 檔輸出路徑為 `/logs/manual-prompts/`，採時間戳 + `invokeId` 檔名，不覆蓋既有檔案。
- [ ] 輸入契約為**網頁 LLM 回傳之純文字** + 結束符 `<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>`。
- [ ] 正式部署／runner **預設不設** `AI_AGENT_MANUAL_LLM`。
- [ ] **本 PR 不包含** Supabase／Phase A **寫入控制**開發（§2.4）。
- [ ] 文件註明**預期貼上次數**隨 batch 與 repair 倍增。
- [ ] 第一版**不**要求 Recorder／DB 審計擴充；以終端輸出為主（§0.1、§1.3）。
- [ ] （可選）`usage` 等 `InvokeLlmOutput` 欄位 placeholder。

---

## 10. 已定案（交付實作）

1. **模型輸入結束符（寫死）**：`<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>`。
   - EOF（§0.2）可作為輔助，但主要流程與提示字串一律使用上述結束符。

（**Recorder／錄製檔**：依 §0.1、§1.3 **不**作為第一版必做項目。）

---

## 11. 已決議事項對照與剩餘細節

### 11.1 已決議（與先前 §11 草稿對照）

| 議題                       | 決議                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| 開關範圍                   | `AI_AGENT_MANUAL_LLM=true` 控制**全域** `invokeLLM` 文字流程（§1.2、§2.2）。                |
| 標頭 `stageName` / `phase` | 可選 **`modelInput.metadata._m`**（§4.1）；未傳則不強制。                                   |
| Prompt 全文來源            | 僅 **`buildLlmPrompt(modelInput)`**（§4.1（2））。                                          |
| 觀測／錄製                 | **僅終端 print**；不開發錄製檔；Recorder **不**強制（§0.1、§1.3）。                         |
| Timeout                    | manual **忽略** `timeoutMs`／遠端 `retries` 語意，**無上限**等貼上（§2.3、§4.2）。          |
| 併發                       | **全域 FIFO queue** 串行化；manual 實作於**獨立 module**，`invokeLLM` 僅 dispatch（§2.3）。 |
| 貼上內容                   | 僅**網頁 LLM 回傳之純文字**；下游 `extractJsonFromText`（§4.2）。                           |
| 非 TTY / 誤設 env          | **fail**；**禁止**自動退回 API（§1.2、§4.3）。                                              |
| Supabase／寫入控制         | **不開發**；本規格不納入 persist 開關（§2.4）。                                             |

### 11.2 實作時仍須定案的細節（非產品決策）

- **`buildLlmPrompt(modelInput)`：** 實作須與現有 **xAI／provider** 對 `prompt` + `messages` 的拼接一致（§4.1（2）、§6）。
- **Manual 回傳形狀：** `path` / `attempts` / `usedFallback` 建議固定（如 `path: ["manual"]`、`attempts: 1`）；**`onProviderError` 不呼叫**。
- **§10：** 結束符擇一寫死。
  - 已定：`<<<AI_AGENT_MANUAL_LLM_RESPONSE_END>>>`。
- **編碼／Windows：** UTF-8；結束行優先於 EOF（操作建議）。

---

_文件版本：修訂（§0 名詞、metadata.\_m、buildLlmPrompt 單一來源、`/logs/manual-prompts/` 時間戳檔名、不強制 Recorder／錄製）。_
