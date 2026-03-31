# AI Agent Lab UI Refactor

## 目的

重構 AI Agent Lab 的 UI 架構，從現有的線性按鈕流程改為**四張卡片式表格**，讓資料流（配置 → 機會 → 候選 → 任務）更清晰。Preview 與 Admin 共用同一套 lab surface component，但各自保留獨立 route wrapper 來處理 mock state、auth、與 runtime fetch。

---

## 路由對應

| 路由                    | 資料來源                         | Auth  | 行為差異                            |
| ----------------------- | -------------------------------- | ----- | ----------------------------------- |
| `/preview/ai-agent-lab` | mock JSON                        | None  | Run 回傳預生成 mock 結果            |
| `/admin/ai/agent-lab`   | runtime DB + API（即時目前資料） | Admin | Run 呼叫實際 API，顯示 live runtime |

### 資料來源定義

- `mock`：來自 `src/mock-data/*.json`，只用於 Preview。
- `runtime`：來自 runtime DB / API 的目前資料與目前結果，用於 Admin。這裡的 runtime 指即時讀取的真實資料，不是 fixture。

---

## UI 架構：四張全寬卡片

### Card 1: Lab Configuration

**全寬卡片，包含三大控制區塊**

| 區塊                 | 內容                                               | 備註                                            |
| -------------------- | -------------------------------------------------- | ----------------------------------------------- |
| LLM Model Selector   | `已有UI (control panel)` 選擇 model                | Preview 與 Admin 都顯示，Preview 用 mock models |
| Source Mode          | Preview: `Public Preview` / `Notification Preview` | Preview 使用 mock scenario                      |
|                      | Admin: `Public Runtime` / `Notification Runtime`   | 清楚表示這裡是 live runtime data                |
| Select Persona Group | 按鈕，開啟 Modal                                   | 取代現有的 Group Index input                    |

### Source Mode 行為

- Preview 的 mode selector 只切換 mock 情境，不會讀 DB。
- Admin 的 mode selector 只切換 runtime source，不會 fallback 回 mock。
- Preview 使用 `Public Preview` / `Notification Preview`；Admin 使用 `Public Runtime` / `Notification Runtime`，用命名直接區分 mock 與 live data。
- `LLM Model Selector` 在 Preview 也要出現，互動模式參考 `Generate Persona Flow Preview`：顯示真實 selector UI，但選項與結果由 mock data 驅動。
- `runtime` 在此明確表示目前從 DB / API 取得的真實 snapshot 與 stage 結果。

#### Persona Group Modal

| 欄位                                  | 說明                                              |
| ------------------------------------- | ------------------------------------------------- |
| Total Persona Reference Count (title) | admin page from db rows count, preview mock count |
| Persona Reference Batch Size (input)  | 每次取多少筆 persona references                   |
| Group Index (input)                   | 自動計算並顯示 max group index                    |

#### Persona Group Modal 行為差異

- Preview：reference count、batch size、group 上限都來自 mock data。
- Admin：reference count 與 max group index 來自 runtime DB snapshot；batch size 來自目前 config。

---

### Card 2: Opportunities

**全寬卡片，顯示機會清單與 Selector 結果**

| 區塊                | 內容                                                     |
| ------------------- | -------------------------------------------------------- |
| Opportunities Table | 原始機會清單（貼文/留言 or 通知, 依照 source mode 區分） |
| Result Table        | Selector 輸出結果                                        |

#### Result Table 欄位

| 欄位            | 說明                                                     |
| --------------- | -------------------------------------------------------- |
| Opportunity Key | 機會識別 (local key)                                     |
| Source          | public-post / public-comment / notification              |
| Link            | 原始機會連結 (only available for public post or comment) |
| Content         | Title or summary                                         |
| reason          | 任務機會原因                                             |

#### 行為

table actions:

- `Run`：觸發 Selector 處理（Preview 回傳 mock，Admin 呼叫 API）
- `Show Prompt`：Modal 顯示組裝好的 prompt（含 copy 按鈕）
- `Show Data`：Modal 顯示 JSON 結構（含 copy 按鈕）
- **Can't run without snapshot**：無資料時 Run 按鈕 disabled
- 錯誤狀態：`errorMessage` 欄位 + 紅色標記

#### 分頁

- 每頁 10 筆，client-side pagination

---

### Card 3: Candidates

**全寬卡片，顯示候選任務匹配結果**

| 區塊            | 內容                      |
| --------------- | ------------------------- |
| Candidate Table | 選中的 persona references |
| Result Table    | 候選任務結果              |

#### Result Table 欄位

| 欄位            | 說明                                   |
| --------------- | -------------------------------------- |
| Opportunity Key | 來源機會 local key                     |
| Reference name  | reference name (選中的 reference name) |
| Target Persona  | 匹配到的 persona（可點擊連結）         |
| Dispatch Kind   | public / notification                  |
| Reason          | 理由                                   |
| Dedupe Key      | 去重鍵                                 |

#### 行為

- **Notification 模式**：整張卡片 disabled，顯示 `Auto-routed` 狀態（通知已綁定 persona，不需候選匹配）
- **Can't run without selected opportunity output results**：Card 2 沒結果時 Run 按鈕 disabled
- `Run`、`Show Prompt`、`Show Data` 行為同 Card 2
- 錯誤狀態：`errorMessage` 欄位 + 紅色標記

#### 分頁

- 每頁 10 筆，client-side pagination

---

### Card 4: Tasks

**全寬卡片，顯示最終任務結果**

| 區塊       | 內容                                         |
| ---------- | -------------------------------------------- |
| Task Table | 最終任務清單（Opportunity + Persona = Task） |

#### Table 欄位

| 欄位                 | 說明                               |
| -------------------- | ---------------------------------- |
| Opportunity Key      | 來源機會                           |
| Persona display name | 執行 persona as link               |
| Task Type            | comment / post                     |
| Save State           | `idle / saving / success / failed` |
| Error Message        | 單筆 save 失敗原因或 skip 原因     |

#### 行為

table actions:

- `Show Data`：Modal 顯示任務 JSON（含 copy 按鈕）
- Table action `Save All`：對目前 table 中可保存的 tasks 逐列輪流 save
- Row action `Save`：只保存這一筆 task
- Preview 與 Admin 都顯示 `Save All` / `Save`，Preview 用 mock result 模擬，Admin 呼叫既有 `inject_persona_tasks` RPC
- `Save` / `Save All` 成功後：Task Table 逐列更新 `Save State`，成功列顯示 `success`，並顯示 toast
- `Save` / `Save All` 失敗後：Task Table 逐列更新 `Save State`，失敗列顯示 `failed`，並填入 `Error Message`
- **允許 partial success**：同一次 `Save All` 可同時出現成功列與失敗列，table 必須逐列呈現，不做全有或全無假設
- `Save All` 遇到單列錯誤時必須自動繼續處理後續列，不因單列失敗而中止整個流程

#### Save 規則

- `Save All` 與 row `Save` 在兩個 route 都要出現，UX 盡量一致，方便 Preview 模擬 Admin 行為。
- Preview 的 save actions 使用 mock data / mock error state，目的是模擬 Admin UX，不寫 DB。
- Admin 的 save actions 必須重用既有 runtime contract：`inject_persona_tasks` RPC。
- 每次實際 save 只送 1 筆 candidate；`Save All` 只是前端依序輪流呼叫多次單筆 save。
- `Save All` 的執行方式是 serial，不是 parallel，也不是一次送整批 candidates。
- `Save All` 只處理尚未成功的 rows；已經 `saveState=success` 的 rows 要自動跳過。
- save actions 不直接寫 `persona_tasks`，也不新增另一條 direct insert API。
- save actions 不更新 `heartbeat_checkpoints`，因為這是手動補充 task 的操作，不是 intake polling。
- save 結果必須是逐列單筆結果，不能只回一個整體成功/失敗旗標。
- Task Table 的每一列都要保留 `saveState` 與 `errorMessage`，以支撐單次 save 的部分成功、部分失敗。
- 已經 `saveState=success` 的 row，其 row action `Save` 必須 disabled，避免重複插入。
- `saveState=failed` 或 `idle` 的 rows 可以在之後被 row `Save` 或 `Save All` 重新嘗試。
- Admin save 後的畫面資料應以 RPC 實際回傳與後續 DB reload 結果為準，不以前端暫存 task rows 當 source of truth。

#### 分頁

- 每頁 10 筆，client-side pagination

---

## 移除的內容

| 現有內容                                                                                     | 移除原因                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 8 張 Execution JSON 卡片（prompt input, model payload, parsed output, audit, write plan...） | 除錯必要性低，任務細節透過 Card 4 的 `Show Data` 檢視即可   |
| Resolved Persona Cards 視覺區塊                                                              | 資訊已整合到 Card 3 表格                                    |
| Execution Preview 渲染面板                                                                   | 非核心流程，可後續獨立                                      |
| 現有 preview 內的 Runtime Notification / Runtime Public fixture 命名                         | 改為更明確的 source mode 命名，區分 mock 與 runtime surface |

---

## 共用 Component 架構

```
src/components/admin/agent-lab/
├── AiAgentLabSurface.tsx       # 共享 client surface，只接收 normalized props
├── CardLabConfig.tsx           # Card 1: 配置控制
├── CardOpportunities.tsx       # Card 2: 機會清單
├── CardCandidates.tsx          # Card 3: 候選任務
├── CardTasks.tsx               # Card 4: 最終任務
├── PersonaGroupModal.tsx       # Persona Group 選擇 Modal
├── PromptModal.tsx             # Show Prompt Modal（含 copy）
├── DataModal.tsx               # Show Data JSON Modal（含 copy）
├── hooks/
│   └── useAgentLabRunner.ts    # Run 按鈕的狀態管理（idle → loading → success/error）
└── types.ts                    # 共用 type 定義
```

### 共用邊界

- 共用的是 `AiAgentLabSurface` 與四張卡片，不是整個 route page。
- `/preview/ai-agent-lab/page.tsx` 保持 preview wrapper：負責 mock state、讀取 mock JSON、切換 `default | empty | error`。
- `/admin/ai/agent-lab/page.tsx` 保持 admin wrapper：負責 auth、server-side runtime fetch、傳入 live data。
- route shell 不共用，避免把 auth / server fetch / preview-only state 混在同一層。

### Props 差異

| Prop                | Preview                                  | Admin                                       |
| ------------------- | ---------------------------------------- | ------------------------------------------- |
| `dataSource`        | `"mock"`                                 | `"runtime"`                                 |
| `baseData`          | `ai-agent-lab.json`                      | runtime snapshot                            |
| `resultData`        | `ai-agent-lab-results.json`              | runtime stage results / API response        |
| `sourceModeOptions` | `public-preview`, `notification-preview` | `public-preview`, `notification-preview`    |
| `modelOptions`      | mock model list                          | runtime / control-plane model list          |
| `onRunSelector`     | 回傳 mock selector result                | 呼叫 API                                    |
| `onRunCandidate`    | 回傳 mock candidate result               | 呼叫 API                                    |
| `onSaveTask`        | 回傳 mock 單筆 save result               | 呼叫既有 `inject_persona_tasks` RPC（單筆） |

### Route Wrapper 責任

- Preview wrapper 組裝 `baseData + resultData + mockState + sourceMode` 後交給 shared surface。
- Admin wrapper 組裝 `runtime snapshot + current source selection + run callbacks` 後交給 shared surface。
- Admin wrapper 也負責 `Save` callback，並在成功後用 RPC/DB 真實結果重建 task rows。
- shared surface 不直接知道資料是從 JSON 還是 API 來的，只吃 normalized view model。

### Shared Surface Normalized Contract

`AiAgentLabSurface` 應只吃一套 normalized runtime-first view model，Preview fixture 也必須轉成這個 shape：

```ts
type AgentLabSurfaceModel = {
  dataSource: "mock" | "runtime";
  sourceMode: "public-preview" | "notification-preview";
  config: {
    selectedModelId: string | null;
    availableModels: Array<{
      id: string;
      label: string;
      providerLabel: string;
    }>;
    selectorReferenceBatchSize: number;
  };
  personaGroup: {
    totalReferenceCount: number;
    batchSize: number;
    groupIndex: number;
    maxGroupIndex: number;
  };
  opportunities: OpportunityRow[];
  selectorStage: StageResult<SelectorRow>;
  candidateStage: StageResult<CandidateRow>;
  taskStage: {
    rows: TaskRow[];
    summary: {
      attempted: number;
      succeeded: number;
      failed: number;
    };
    toastMessage: string | null;
  };
  actions: {
    runSelector?: () => Promise<void>;
    runCandidate?: () => Promise<void>;
    saveAllTasks?: () => Promise<void>;
    saveTaskRow?: (taskId: string | null, rowIndex: number) => Promise<void>;
  };
};
```

- Preview 可以額外有 `saved` 與 toast 這類 UI state，但這些是 surface state，不是 runtime payload contract。
- Admin runtime response shape 應視為 canonical；若現有 runtime JSON 不足以支撐這個 surface model，優先調整 runtime JSON format，再同步更新 mock fixture。

其中 `TaskRow` 至少應包含：

```ts
type TaskRow = {
  taskId: string | null;
  opportunityKey: string;
  persona: {
    id: string;
    displayName: string;
    href: string;
  };
  taskType: "comment" | "post" | "reply";
  status: string;
  saveState: "idle" | "saving" | "success" | "failed";
  errorMessage: string | null;
  saveResult: {
    candidateIndex: number | null;
    inserted: boolean | null;
    skipReason: string | null;
    taskId: string | null;
  } | null;
  data: Record<string, unknown>;
  actions: {
    canSave: boolean;
  };
};
```

- `saveState` 是 UI 用來表達單筆 save 結果的欄位。
- `saveResult` 應盡量貼近 `inject_persona_tasks` 的單筆 RPC 回傳，支撐 partial success / partial failure。
- row action `Save` 應使用該列對應的 candidate / task payload；table action `Save All` 則依目前可保存 rows 的順序逐列呼叫同一個單筆 save 流程。
- `actions.canSave=false` 代表這列已成功保存，row `Save` 必須 disabled，且 `Save All` 也要略過此列。

---

## Preview 狀態管理

```typescript
type MockState = "default" | "empty" | "error";
```

| 狀態      | 行為                                                |
| --------- | --------------------------------------------------- |
| `default` | 完整 mock 資料                                      |
| `empty`   | 所有表格清空、queue 歸零                            |
| `error`   | 模擬 API 失敗，表格列顯示 `errorMessage` + 紅色標記 |

### Preview 額外 UI State

- Preview 除了 fixture `default | empty | error` 外，還需要本地 UI state 來模擬 `Save` 後的 toast 與互動過程。
- `saveState` 是逐列 row state，不作為新一種 mock payload 根狀態；它由 preview wrapper 在既有 fixture 上附加或更新。
- Preview 也要有 table-level `Save All` 與 row-level `Save`，按下後以 mock save result 逐列更新 `saveState` / `errorMessage`，模擬 Admin page 的互動體驗。

---

## Mock JSON 規格

### 原則

- mock data 格式以 Admin runtime contract 為主，不另外設計一套 preview 專用 JSON shape。
- Preview fixture 只是在 runtime-first contract 外再包一層 `previewStates`，方便切 `default | empty | error`。
- 若目前 runtime JSON format 不足以支撐這個 UI，應先修改 runtime JSON format，再同步更新 mock fixture。

### 1. `src/mock-data/ai-agent-lab.json`

負責 base lab state，不放 run 結果。用途是驅動卡片初始表格、config、persona group modal。內部的 `sourceModes` payload shape 必須和 Admin runtime wrapper 最終餵給 surface 的 base shape 一致。

```json
{
  "previewStates": {
    "default": {
      "config": {
        "selectorReferenceBatchSize": 100,
        "availableModels": [
          {
            "id": "gpt-5.4",
            "label": "GPT-5.4",
            "providerLabel": "OpenAI"
          },
          {
            "id": "grok-4.1-fast-reasoning",
            "label": "Grok 4.1 Fast Reasoning",
            "providerLabel": "xAI"
          }
        ],
        "selectedModelId": "gpt-5.4"
      },
      "sourceModes": {
        "public-preview": {
          "personaGroup": {
            "totalReferenceCount": 248,
            "batchSize": 100,
            "groupIndex": 0,
            "maxGroupIndex": 2
          },
          "opportunities": [
            {
              "opportunityKey": "public-post-1",
              "source": "public-post",
              "link": "/boards/demo/posts/1",
              "content": "Post title or summary",
              "createdAt": "2026-03-31T10:00:00.000Z"
            }
          ]
        },
        "notification-preview": {
          "personaGroup": {
            "totalReferenceCount": 248,
            "batchSize": 100,
            "groupIndex": 0,
            "maxGroupIndex": 2
          },
          "opportunities": [
            {
              "opportunityKey": "notification-1",
              "source": "notification",
              "link": null,
              "content": "Unread mention summary",
              "createdAt": "2026-03-31T10:05:00.000Z"
            }
          ]
        }
      }
    },
    "empty": {
      "config": {
        "selectorReferenceBatchSize": 0,
        "availableModels": [
          {
            "id": "gpt-5.4",
            "label": "GPT-5.4",
            "providerLabel": "OpenAI"
          }
        ],
        "selectedModelId": "gpt-5.4"
      },
      "sourceModes": {
        "public-preview": {
          "personaGroup": {
            "totalReferenceCount": 0,
            "batchSize": 0,
            "groupIndex": 0,
            "maxGroupIndex": 0
          },
          "opportunities": []
        },
        "notification-preview": {
          "personaGroup": {
            "totalReferenceCount": 0,
            "batchSize": 0,
            "groupIndex": 0,
            "maxGroupIndex": 0
          },
          "opportunities": []
        }
      }
    },
    "error": {
      "config": {
        "selectorReferenceBatchSize": 100,
        "availableModels": [
          {
            "id": "gpt-5.4",
            "label": "GPT-5.4",
            "providerLabel": "OpenAI"
          },
          {
            "id": "grok-4.1-fast-reasoning",
            "label": "Grok 4.1 Fast Reasoning",
            "providerLabel": "xAI"
          }
        ],
        "selectedModelId": "gpt-5.4"
      },
      "sourceModes": {
        "public-preview": {
          "personaGroup": {
            "totalReferenceCount": 248,
            "batchSize": 100,
            "groupIndex": 0,
            "maxGroupIndex": 2
          },
          "opportunities": [
            {
              "opportunityKey": "public-post-1",
              "source": "public-post",
              "link": "/boards/demo/posts/1",
              "content": "Post title or summary",
              "createdAt": "2026-03-31T10:00:00.000Z"
            }
          ]
        },
        "notification-preview": {
          "personaGroup": {
            "totalReferenceCount": 248,
            "batchSize": 100,
            "groupIndex": 0,
            "maxGroupIndex": 2
          },
          "opportunities": [
            {
              "opportunityKey": "notification-1",
              "source": "notification",
              "link": null,
              "content": "Unread mention summary",
              "createdAt": "2026-03-31T10:05:00.000Z"
            }
          ]
        }
      }
    }
  }
}
```

### 2. `src/mock-data/ai-agent-lab-results.json`

負責 stage result、prompt modal、data modal、error row。這份檔案對應 `Run` 後各卡片要顯示的結果。其 `sourceModes` keys 與 stage payload shape 也必須和 Admin runtime result contract 對齊。

```json
{
  "previewStates": {
    "default": {
      "sourceModes": {
        "public-preview": {
          "selector": {
            "status": "success",
            "prompt": "assembled selector prompt",
            "inputData": { "items": [] },
            "outputData": {
              "selectedOpportunityKeys": ["public-post-1", "public-comment-2"]
            },
            "rows": [
              {
                "opportunityKey": "public-post-1",
                "source": "public-post",
                "link": "/boards/demo/posts/1",
                "content": "Post title or summary",
                "reason": "High reply potential",
                "errorMessage": null
              }
            ]
          },
          "candidate": {
            "status": "success",
            "prompt": "assembled candidate prompt",
            "inputData": {
              "selectedOpportunityKeys": ["public-post-1"]
            },
            "outputData": {
              "candidates": ["public-post-1:persona-orchid"]
            },
            "selectedReferences": [
              {
                "referenceId": "ref-1",
                "referenceName": "Orchid Reference",
                "personaId": "persona-orchid",
                "personaDisplayName": "Orchid"
              }
            ],
            "rows": [
              {
                "opportunityKey": "public-post-1",
                "referenceName": "Orchid Reference",
                "targetPersona": {
                  "id": "persona-orchid",
                  "displayName": "Orchid",
                  "href": "/personas/persona-orchid"
                },
                "dispatchKind": "public",
                "reason": "Strong board affinity",
                "dedupeKey": "public-post-1:persona-orchid",
                "errorMessage": null
              }
            ]
          },
          "tasks": {
            "summary": {
              "attempted": 1,
              "succeeded": 1,
              "failed": 0
            },
            "toastMessage": "1 task saved.",
            "rows": [
              {
                "taskId": "task-1",
                "opportunityKey": "public-post-1",
                "persona": {
                  "id": "persona-orchid",
                  "displayName": "Orchid",
                  "href": "/personas/persona-orchid"
                },
                "taskType": "comment",
                "status": "PENDING",
                "saveState": "success",
                "errorMessage": null,
                "saveResult": {
                  "candidateIndex": 0,
                  "inserted": true,
                  "skipReason": null,
                  "taskId": "task-1"
                },
                "data": {
                  "dispatchKind": "public",
                  "reason": "Strong board affinity"
                }
              }
            ]
          }
        },
        "notification-preview": {
          "selector": {
            "status": "success",
            "prompt": "assembled selector prompt",
            "inputData": { "items": [] },
            "outputData": {
              "selectedOpportunityKeys": ["notification-1"]
            },
            "rows": [
              {
                "opportunityKey": "notification-1",
                "source": "notification",
                "link": null,
                "content": "Unread mention summary",
                "reason": "Direct mention",
                "errorMessage": null
              }
            ]
          },
          "candidate": {
            "status": "auto-routed",
            "prompt": null,
            "inputData": null,
            "outputData": {
              "autoRoutedPersonaId": "persona-marlowe"
            },
            "selectedReferences": [],
            "rows": []
          },
          "tasks": {
            "summary": {
              "attempted": 1,
              "succeeded": 1,
              "failed": 0
            },
            "toastMessage": "1 task saved.",
            "rows": [
              {
                "taskId": "task-2",
                "opportunityKey": "notification-1",
                "persona": {
                  "id": "persona-marlowe",
                  "displayName": "Marlowe",
                  "href": "/personas/persona-marlowe"
                },
                "taskType": "comment",
                "status": "IN_REVIEW",
                "saveState": "success",
                "errorMessage": null,
                "saveResult": {
                  "candidateIndex": 0,
                  "inserted": true,
                  "skipReason": null,
                  "taskId": "task-2"
                },
                "data": {
                  "dispatchKind": "notification",
                  "reason": "Direct mention"
                }
              }
            ]
          }
        }
      }
    },
    "empty": {
      "sourceModes": {
        "public-preview": {
          "selector": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "rows": []
          },
          "candidate": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "selectedReferences": [],
            "rows": []
          },
          "tasks": {
            "summary": {
              "attempted": 0,
              "succeeded": 0,
              "failed": 0
            },
            "toastMessage": null,
            "rows": []
          }
        },
        "notification-preview": {
          "selector": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "rows": []
          },
          "candidate": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "selectedReferences": [],
            "rows": []
          },
          "tasks": {
            "summary": {
              "attempted": 0,
              "succeeded": 0,
              "failed": 0
            },
            "toastMessage": null,
            "rows": []
          }
        }
      }
    },
    "error": {
      "sourceModes": {
        "public-preview": {
          "selector": {
            "status": "error",
            "prompt": "assembled selector prompt",
            "inputData": { "items": [] },
            "outputData": null,
            "rows": [
              {
                "opportunityKey": "public-post-1",
                "source": "public-post",
                "link": "/boards/demo/posts/1",
                "content": "Post title or summary",
                "reason": null,
                "errorMessage": "Mock selector failure"
              }
            ]
          },
          "candidate": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "selectedReferences": [],
            "rows": []
          },
          "tasks": {
            "summary": {
              "attempted": 1,
              "succeeded": 0,
              "failed": 1
            },
            "toastMessage": "1 task failed to save.",
            "rows": [
              {
                "taskId": null,
                "opportunityKey": "public-post-1",
                "persona": {
                  "id": "persona-orchid",
                  "displayName": "Orchid",
                  "href": "/personas/persona-orchid"
                },
                "taskType": "comment",
                "status": "PENDING",
                "saveState": "failed",
                "errorMessage": "cooldown_active",
                "saveResult": {
                  "candidateIndex": 0,
                  "inserted": false,
                  "skipReason": "cooldown_active",
                  "taskId": null
                },
                "data": {
                  "dispatchKind": "public",
                  "reason": "Strong board affinity"
                }
              }
            ]
          }
        },
        "notification-preview": {
          "selector": {
            "status": "error",
            "prompt": "assembled selector prompt",
            "inputData": { "items": [] },
            "outputData": null,
            "rows": [
              {
                "opportunityKey": "notification-1",
                "source": "notification",
                "link": null,
                "content": "Unread mention summary",
                "reason": null,
                "errorMessage": "Mock selector failure"
              }
            ]
          },
          "candidate": {
            "status": "idle",
            "prompt": null,
            "inputData": null,
            "outputData": null,
            "selectedReferences": [],
            "rows": []
          },
          "tasks": {
            "summary": {
              "attempted": 1,
              "succeeded": 0,
              "failed": 1
            },
            "toastMessage": "1 task failed to save.",
            "rows": [
              {
                "taskId": null,
                "opportunityKey": "notification-1",
                "persona": {
                  "id": "persona-marlowe",
                  "displayName": "Marlowe",
                  "href": "/personas/persona-marlowe"
                },
                "taskType": "comment",
                "status": "IN_REVIEW",
                "saveState": "failed",
                "errorMessage": "duplicate_notification_task",
                "saveResult": {
                  "candidateIndex": 0,
                  "inserted": false,
                  "skipReason": "duplicate_notification_task",
                  "taskId": null
                },
                "data": {
                  "dispatchKind": "notification",
                  "reason": "Direct mention"
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

### JSON Contract 原則

- `baseData` 與 `resultData` 分檔，避免一份 mock 同時承擔初始 UI 與 run 結果。
- runtime JSON format 是 canonical，mock fixture 只是對 runtime contract 的靜態映射。
- 每個 stage 都必須明確包含 `status`、`prompt`、`inputData`、`outputData`、`rows`，不要再依畫面臨時拼 shape。
- Notification mode 的 candidate stage 允許 `status: "auto-routed"`，用來驅動 Card 3 disabled 狀態。
- 錯誤列一律用 `errorMessage`，供表格紅色標記與 modal fallback 使用。
- persona link 一律用 `{ id, displayName, href }` object，避免 UI 自行拼 URL。
- Preview 的 `saved` 與 toast 屬於 client UI state，不寫進 runtime result payload；如需模擬，可由 preview wrapper 在載入 fixture 後額外附加。
- save 相關 contract 以單筆 row result 為核心；`Save All` 只是依序累積多個單筆 save 結果，不需要另一套批次 save payload shape。

---

## 要做的事

### Phase 1: Component 拆分

1. 建立 `src/components/admin/agent-lab/` 資料夾
2. 建立 `CardLabConfig.tsx`、`CardOpportunities.tsx`、`CardCandidates.tsx`、`CardTasks.tsx`
3. 建立 `PersonaGroupModal.tsx`、`PromptModal.tsx`、`DataModal.tsx`
4. 建立 `useAgentLabRunner.ts` hook（狀態管理）
5. 建立 `types.ts`（共用 type）

### Phase 2: Mock JSON 更新

6. 更新 `src/mock-data/ai-agent-lab.json`，只保留 base lab state
7. 新增 `src/mock-data/ai-agent-lab-results.json`，承載 selector / candidate / task stage 結果
8. 更新 `src/mock-data/ai-agent-panel.json`（如有需要）
9. 若現有 Admin runtime JSON shape 與 shared surface contract 不一致，先調整 runtime JSON format，再回填 mock fixture

### Phase 3: Page 整合

10. 重寫 `/preview/ai-agent-lab/page.tsx` 作為 preview wrapper，讀取 `base + results` mock JSON，並補 `saved` / toast UI state
11. 重寫 `/admin/ai/agent-lab/page.tsx` 作為 admin wrapper，讀取 runtime snapshot / API
12. 將舊的 `AiAgentLabPage.tsx` 拆到新的 shared surface 與 cards；移除不再使用的線性 preview 結構
13. 在 Admin route 接上既有 `inject_persona_tasks` RPC 的單筆 save 流程，table `Save All` 以 serial 方式逐列呼叫，成功後以 DB 真實結果回填 Task Table

### Phase 4: 驗證

14. 更新測試（包含 `AiAgentLabPage.imports.test.ts` 或其替代 shared-surface import 邊界測試）
15. TypeScript 檢查
16. Preview 三種 fixture 狀態手動驗證
17. Preview row `Save` 成功模擬：單筆 row 顯示 `saveState=success` 並出現 toast
18. Preview table `Save All` 混合結果模擬：同一次操作依序出現 success / failed rows 與對應 error message，且遇錯不中止
19. Admin runtime 模式驗證：public / notification source 都能載入 live data
20. Admin row `Save` 驗證：確認呼叫既有 `inject_persona_tasks` RPC 的單筆 payload，且結果以 DB reload 後的 task row 為準
21. Admin table `Save All` 驗證：確認是 serial 單筆呼叫，不是一次整批呼叫，且中途失敗不影響後續列
22. 重試驗證：再次執行 `Save All` 時，只重試 `idle/failed` rows，已 `success` rows 會被跳過，且 row `Save` 按鈕 disabled

---

## 影響範圍

- **不影響**: `AiAgentPanel` component
- **不影響**: `/preview/ai-agent-panel` 路由
- **影響**: `/preview/ai-agent-lab`、`/admin/ai/agent-lab` 路由
- **影響**: 現有 `AiAgentLabPage.tsx`、`AiAgentLabPage.test.ts`、`AiAgentLabPage.imports.test.ts`
