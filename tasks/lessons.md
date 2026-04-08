# Lessons Learned

## AI Agent Runtime

- 當使用者要先「討論 UI / 架構」時，先進入設計對話模式：先給現況判讀、選項與取捨，再一次只問一個關鍵問題；不要把對話過早推成 implementation scope confirmation。
- 當使用者選 `Operator Console + Hard Split` 時，不要再用「保留現有 panel 大部分邏輯」當前提；應明確區分要保留的是資料/API domain 邏輯，而不是既有頁面狀態機、JSON debug UI、或舊資訊架構。
- 當使用者明確指定「進頁不需要 server snapshot」時，panel 設計必須轉成 client-loaded operator console；不要再把 SSR snapshot/read-model preload 當成預設。
- 當使用者要求新增獨立 runtime 處理 admin 指定 docs 時，先從 queue ownership、worker isolation、resource/quota 邊界、與既有 AI runtime 衝突面拆方案，再談 UI 與實作。
- 名稱必須反映實際職責；若功能是在既有 persona/media 輸出上做 post/comment 內容更新，就不要用 `docs` 這種會誤導成文件系統或知識庫處理的名稱。
- 若同一個 admin 手動 runtime 之後會同時承接內容改寫與 persona memory 任務，命名不能再侷限於 `edit`；應提升到 `manual jobs` / `admin tasks` 這種覆蓋多任務型別的語意層級。
- `Memory` tab 可以以 `persona_memories` 為資料來源，但執行動作應排進共享 manual-jobs queue；memory compressor 的 job key 應以 `persona_id` 為主，而不是綁單一 memory row id。
- `content_edit_history` 應保持精簡；若 `edit_kind` 與 `after_snapshot` 對當前 operator/audit 需求沒有新增訊息，就不要保留。被覆寫前的內容欄位應用更直白名稱，例如 `previous_snapshot`。
- 若某欄位明確決定列表優先順序，例如 `last_compressed_at`，應把它當作 query-level ordering 規則寫進設計，而不是只描述成前端顯示排序。表格中的 persona 呈現則優先重用既有 persona UI，而不是再定義一套新 cell 規格。
- `manual_job_tasks` 的 dedupe 只應阻擋 active rows（如 `PENDING` / `RUNNING`），不能阻擋終態後的 redo。`Jobs` tab 若要極簡欄位，可把必要狀態收斂進 `Job` cell，而不是強制保留獨立 `Status` / `Requested` / `Source` columns。
- 若 job queue 已成為所有 admin 手動任務的唯一入口，表名可簡化為 `job_tasks`。`content_edit_history.previous_snapshot` 不應直接關聯 job；應由 history row 以明確 `job_task_id` 或等價來源欄位關聯到 `job_tasks`，而 `previous_snapshot` 只保存被覆寫前的內容。
- 若 jobs queue 的主用途是定位「本次要處理哪個資源」，優先用單一 `subject_kind/subject_id`，不要同時保留 `source_*` 與 `target_*` 造成語意重複。`job_type` 應描述任務類別本身，而不是把 `redo` 之類的觸發方式硬編進型別名稱。
- 若 operator 明確要求看 queue 執行狀態，應恢復獨立 `Status` 欄，而不是把狀態塞回 `Job` cell。極簡表格不代表隱藏核心執行狀態。
- 當使用者明確定稿 operator 文案（例如 `Pause / Start`）時，所有設計文檔與後續討論都必須立刻統一；不要在其他模組文檔殘留 `Stop / Restart` 或過渡命名。
- 若專案已經有現成 lane key env（例如 `AI_AGENT_RUNTIME_STATE_KEY`），新的 queue/runtime 設計應直接綁定同一個 key 來源；不要另外描述成獨立、不相干的 runtime key 機制。
- Keep one Phase A source of truth only: `ai_opps -> opportunities -> public candidates / notification direct tasking -> persona_tasks`.
- Remove old flow code, tests, and docs in the same pass; execute-path migration alone is not enough.
- Keep preview, admin, and runtime on the same stage contract even when preview stays fixture-backed.
- Use local keys for LLM JSON stages; keep DB ids and persona ids app-owned and resolved outside the model.
- Persist staged LLM work incrementally in 10-row batches so partial progress survives crashes and reruns.
- Public and notification diverge after scoring: public goes through candidates; notification uses deterministic recipient persona routing.
- `matched_persona_count` is cumulative and may only increase on newly inserted unique personas.
- Admin page load is ingest-only: sync snapshot into `ai_opps`, query persisted rows, and only run `Opportunities LLM` from explicit `Run`.
- Admin manual runs are one-click, one-batch; do not silently auto-loop extra batches on the client.
- Admin result tables may keep newly processed rows visible even when the next batch input comes only from unfinished rows.
- Manual `Run Phase A` is request-only, consumed by the runtime app, and must not reset automatic cooldown.
- Runtime online/offline must come from a runner heartbeat, not from lease or cooldown state.
- Local Phase A debug commands must not mutate runtime heartbeats, runtime cooldown state, or heartbeat checkpoint rows; repeated debug runs need a read-only snapshot path.
- Preview running UI should reflect real row semantics: preserve static cells, limit skeletons to unresolved fields, and show `Saving` only on rows actually retrying.
- Notification downstream tables are append-style during `Opportunities` runs; they should not enter full-table loading states.
