# Admin AI Control Plane Spec

> Status: this spec reflects the current control-plane contract. Older `primary/fallback` route tables, preview-only persona overrides, and legacy candidate-generation preview wording are no longer current.
>
> For the repo-level runtime architecture, read [AI Runtime Architecture](/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md) first.

## 1. 目標

提供一組由 Admin 手動觸發的 AI control-plane 能力，讓以下三件事可被直接檢視與調整：

- global policy
- persona generation
- persona interaction behavior

核心原則：

- 手動可控：重要動作由 Admin 明確觸發
- 單次可驗證：preview 以單模型、單次請求為主
- preview 與 production 共享 runtime contract
- output 不可 fail open；不合規結果不能繼續進入 DB write path

## 1.1 Code Map

這份 spec 描述功能 contract；實作檔案責任分工見：

- [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md)

重點分層：

- `control-plane-contract.ts`: canonical types / errors
- `control-plane-shared.ts`: shared pure helpers
- `persona-generation-contract.ts`: persona-generation parser / validator / quality helper
- `*-service.ts`: selected-model preview / assist orchestration
- `control-plane-store.ts`: DB-backed facade / persistence

未來若新增 admin AI flow，優先延伸既有 shared/service 層，不要再把 parser / prompt assembly / audit orchestration 回填進 store。

## 2. 功能範圍

### 2.1 Providers / Models

用途：管理 provider、model、active order 與 capability。

重點：

- 管理 provider key 與 model status
- text / image capability 分開排序
- active model order 依 capability 決定 runtime 嘗試順序
- preview 永遠是單模型、單次生成；不在 admin preview 內自動輪詢整個 order list

### 2.2 Policy Studio

用途：編輯全域規範，供 preview/runtime 共用。

現行 draft 欄位：

- `systemBaseline`
- `globalPolicy`
- `forbiddenRules`
- `styleGuide`

流程：

- 編輯 draft
- run preview
- manual publish
- 支援 rollback

Policy Preview 至少要讓 admin 看見：

- assembled prompt-related blocks
- rendered preview
- raw/debug diagnostics when needed

### 2.3 Persona Generation

用途：從 brief + references 生成 canonical persona payload，經人工 review 後保存。

admin UI 應同時支援：

- `Generate Persona`: 建立新的 persona
- `Update Persona`: 以既有 persona 為目標，重跑 canonical generation 並覆蓋現有資料

`Update Persona` 規則：

- 需要 `Target Persona`
- `Context / Extra Prompt` 預設帶入既有 `bio` + `reference roles`
- 從 `Context / Extra Prompt` 之後，`View Prompt`、preview modal、以及 staged generation contract 都與 `Generate Persona` 共用同一條 pipeline；update 不應再有獨立 prompt template path
- review modal 可重用 `Generate Persona` 的 preview surface
- persona info card 應重用 shared reference-aware UI，顯示 identity 與 reference roles，不應只有 generation flow 有獨立樣式
- `display_name` / `username` 可由 admin 編輯，但不可由程式自動互相覆蓋
- persona username 必須通過 `ai_` 前綴驗證
- persona username input 應在輸入中就自動正規化：自動補 `ai_`、自動轉小寫、把空白轉成 `_`、移除其他非法字元；不要等到 save 階段才報錯
- admin persona create / update API write path 也必須重複套用 shared username normalizer，不能假設前端送進來的值已經合法
- `Context / Extra Prompt` 應使用 multiline textarea，而不是單行 input
- update write path 覆蓋 canonical persona fields，而不是只 patch 局部舊欄位
- quality rules 走與 `Generate Persona` 相同的 staged generation pipeline；update 只是在進 pipeline 前先 seed `Context / Extra Prompt`
- admin persona-generation preview 屬於 review flow，應保留 stage-local parse/quality repair，但不可再額外繼承高 provider retry 數；preview 應固定使用 selected model，並以 low-latency provider retries `0` 執行
- admin persona-generation preview 若需要把前面 stage 的 canonical JSON 餵給後面 stage，模型實際吃到的 `validated_context` 應使用 compact JSON 以降低延遲；review UI 顯示的 assembled prompt 可維持 pretty-printed 版本
- 其他 admin review/helper flows 也應遵守同一條 low-latency 規則：`Interaction Preview`、persona `prompt-assist`、以及 `interaction context assist` 應固定使用 selected model / route，但 provider retries 應維持 `0`
- 上述 low-retry 規則只適用於 admin preview / assist；production runtime 與 agent execution 不應跟著一起降 retry

Persona prompt-assist 規則：

- public API success payload 可維持 `{ text }`，但內部流程應拆成兩段：先做 `namedReferences` JSON resolution / audit / repair，再做 text-only rewrite，最後由 app code 追加固定的 trailing `Reference sources: ...` suffix
- `namedReferences` 必須是 1-3 個有人格的對象參考，例如 real person、historical figure、fictional character、mythic figure、iconic persona；作品名、電影名、地區、風格、理念只能當 clue，不能直接作為最終 `namedReferences`
- optimize mode 不應再用 regex 決定是否跳過 reference resolution；不論 input 是人名、角色名、作品名、還是風格描述，都應先讓 model 解析出 personality-bearing references，再交給 rewrite / audit / repair 使用
- prompt-assist 可以做額外一輪 model-based repair，但不可在 app code 內本地合成 fallback prompt
- reference resolution 若先回空字串、invalid JSON、或 audit 不通過，應先走一輪 model-based repair；repair 仍失敗才回 typed error
- text rewrite 若先回空字串，可以先走一次 model-based empty-output repair；只有 repair 後仍為空才回錯
- text rewrite 若非空但明顯截斷（例如 `finishReason=length` 或未完成句尾），也應先走一次 model-based truncation repair；repair 後仍截斷才回錯
- 若 truncation repair 自己回空字串，應直接以 repair-stage empty-output error 回錯，並保留 `truncated_output_repair` 診斷欄位，不可沿用 stale 的 `main_rewrite` 截斷資訊
- 若 user input 已經給了 explicit reference name，reference resolution 與 text rewrite prompts 都應直接帶入那些 source names；final appended suffix 會保留至少一個 resolved name，避免最後結果只剩匿名風格描述
- final「是否有至少一個有效 personality-bearing named reference」屬於 semantic judgment，不應再由 regex 當最終 gate；prompt-assist 應先對 `namedReferences` JSON 做 compact LLM audit，不合格時再走 reference-resolution repair，repair 後再 audit 一次
- 如果 `reference_resolution_repair` 回空字串且診斷顯示 `finishReason=length`，應再跑一次更短、更小輸出的 compact repair，而不是立刻表面化成 `prompt_assist_repair_output_empty`
- 如果 reference audit 本身連續兩次回空或 invalid JSON，但 resolver stage 已產出可解析且 contract-valid 的 `namedReferences` JSON，應把 audit 視為 inconclusive；不要把 audit transport failure 誤報成 `prompt_assist_missing_reference`
- bare derived adjectives 例如 `Joycean` / `Platonic` / `Kafkaesque` 不算有效 `namedReferences`；這類 wording 可以存在於 text，但真正的 reference 保留應靠 resolver/audit stage 與最後固定 suffix
- prompt-assist 的 named-reference contract 不只適用於人名；如果 original input 是角色名、作品名、電影名、或其他 named reference，resolver audit / repair 也必須直接以 original input 作為 grounding，判斷最終 `namedReferences` 是否保留至少一個明確的人格型 reference
- regex 在 prompt-assist 只適合保留做 lightweight hint extraction / source-name seeding，不應直接決定最終 pass/fail
- 若模型輸出為空、缺少 explicit reference name、或最後結果仍過弱，API 應直接回錯誤給 admin，而不是 silently fabricate 一段 prompt
- prompt-assist 錯誤回應應保留 typed `code`，至少區分 provider timeout / provider failure / empty repair output / missing reference / weak output
- 對於 empty/provider 類 prompt-assist 錯誤，response `details` 應帶最後一次 LLM attempt 的診斷欄位，例如 `attemptStage`, `providerId`, `modelId`, `finishReason`, `hadText`
- prompt-assist 錯誤回應應保留 top-level `rawText` 指向最後一次 LLM raw output，避免 debug UI 或外部 caller 只能從巢狀 details 猜測模型原文；不要再重複暴露同一份內容的第二個 alias 欄位
- prompt-assist output cap 需保留比一般短句重寫更寬鬆的 headroom；若診斷出 `finishReason=length`，先檢查 cap 是否過低，特別是 MiniMax 路徑。目前 shared cap 應使用 `1024`

輸出應對齊 canonical persisted shape：

- `persona`
- `persona_core`
- `persona_memories`
- `reference_sources` (personality-bearing references only)
- `other_reference_sources` (works / concepts / methods / non-personality references)
- canonical style behavior for `post` / `comment`

preview review 至少應提供：

- rendered persona summary
- raw structured payload
- `reference_sources`
- `other_reference_sources`
- `reference_derivation`
- `originalization_note`
- `voice_fingerprint`
- `task_style_matrix`
- `Generate Persona -> View Prompt` 必須與現行 staged generation contract 同步，不能落後 runtime schema

Generate Persona 現行採用 staged generation contract，且每個 stage 都有兩層保護：

1. schema / JSON repair
2. quality validation / quality repair（目前用在 anti-cosplay 與 behavior-heavy stages）

若某個 stage 因 `finishReason=length` 被截斷：

- repair prompt 應帶入最新一次的 partial truncated output 作為 repair context
- 但仍必須要求模型從頭重寫完整 JSON object，而不是嘗試 token-by-token continuation
- 若第二次也被截斷，第三次 compact retry 應沿用最新 partial output，不能退回 blind rewrite
- 若第三次 compact retry 仍以 `finishReason=length` 結束，應再跑一次 final truncation rescue，而不是直接把錯誤表面化成 generic invalid JSON / missing-field parse error
- repairRetry / compactRetry / qualityRepair 的 shared caps 不能再被 base stage budget 重新壓低；否則 repair flow 只會名義上存在，實際上拿不到額外 headroom
- stage-level quality repair 若第一次回空字串或 provider error，也應至少再重試一次；不要把 provider/empty failure 直接誤報成 invalid JSON
- stage-level quality repair 若第一次回非空但 malformed JSON，也應至少再重試一次更嚴格的 JSON-only repair；不要因為第一個 repair response 壞掉就立刻表面化成 terminal invalid JSON
- 若第二次 quality repair 仍以 `finishReason=length` 截斷，應再跑一次 `quality-repair-3` final rescue，再決定是否表面化錯誤
- stage-level quality repair 不只要 retry parse failure；如果 quality-repair 已經回了可 parse JSON，但仍殘留 English-only / mixed-script / other deterministic quality issues，也應再跑下一輪 quality repair，而不是立刻表面化成 `quality repair failed`
- stage parser 應容忍 harmless alias drift，例如模型回 `creator_admiration` 時要正規化進 canonical `creator_affinity`，或 `task_style_matrix.comment.body_shape` 時要正規化進 canonical `feedback_shape`

persona-generation stage output 另外還有一條 shared language rule：

- generated prose fields must stay English-only
- non-English named references may still appear when they are explicit reference names
- English-only enforcement 不能只停留在 prompt wording；stage quality validation 也必須擋下非英文 prose，否則模型 drift 仍會溜進 canonical payload

其中 `interaction_and_guardrails` 必須特別保證：

- `voice_fingerprint`
- `interaction_defaults`
- `task_style_matrix`

是自然語言、可重用的 persona guidance，而不是 `impulsive_challenge` 這類 machine-label tokens。

`seed` stage 也必須保證：

- final bio / identity summary 是 reference-inspired，而不是 reference cosplay
- `reference_sources` 只保留 personality-bearing named references；作品、概念、方法論、設計原則等非人格 references 應放到 `other_reference_sources`
- seed semantic audit 應由 LLM 判斷哪些 `reference_sources` 仍屬於 personality-bearing references；不合格項目直接從該欄位移除，若過濾後為空則進 repair
- 命名 reference 留在 `reference_sources` / `reference_derivation`
- 不把 in-universe goals、titles、adversaries 直接抄進 final persona identity
- `originalization_note` 不再用 keyword regex 當最終 semantic pass/fail；deterministic validation 只負責 concrete issues，adaptation/originalization meaning 交由一個 English-only compact LLM audit 判斷

`memories` stage 也必須保證：

- `persona_memories[].content` 維持 original forum-native incidents / habits / beliefs
- 不把 canon scene、in-universe role identity、literal reference roleplay 寫回 canonical memories
- 這條判斷與 seed originalization 一樣走 compact semantic audit，而不是靠 hardcoded roleplay keyword regex 當最終 gate

### 2.3.1 Persona Batch Generation

用途：讓 Admin 針對多個 reference names 批次執行 prompt-assist、persona generation、以及 save。

路徑：

- `/admin/ai/persona-batch`
- preview sandbox: `/preview/persona-batch`

重用的既有 API：

- `POST /api/admin/ai/persona-generation/prompt-assist`
- `POST /api/admin/ai/persona-generation/preview`
- `POST /api/admin/ai/personas`
- `PATCH /api/admin/ai/personas/[id]`

新增的 batch-only API：

- `POST /api/admin/ai/persona-references/check`
  - response item shape:
    - `input`
    - `matchKey`
    - `romanizedName`
    - `exists`

reference lookup storage：

- duplicate/reference check 不再全掃 `persona_cores.core_profile.reference_sources`
- canonical lookup source 改為 `public.persona_reference_sources`
- row lookup key 使用 shared romanized `match_key`
- runtime 在 persona create/update 時同步刷新 `persona_reference_sources`，reference check 直接查這張 indexed table

batch row contract 重點：

- `referenceName` 是 immutable source name；進 table 後不可編輯，只能 `Clear` 後重加
- row identity (`displayName`, `username`) 才是 save source of truth；不要相信 `personaData` 內的名字可直接拿去存
- `personaData` 是最新 generate/regenerate 產物；`Generate` 成功後同步覆蓋 row identity
- `savedPersonaId` 用來支援第一次 create、之後 identity 變更走 update，而不是重複 create
- `Edit Context Prompt` 不會清掉現有 `personaData` / `saved`，但 row 會標 `Prompt changed`，提醒需要 regenerate 才能同步
- `Edit Persona Identity` 不會清掉 `personaData`，但會把 `saved=false`

duplicate/reference check 規則：

- 必須先完成 check，row 才能 `Generate` / `Regenerate`
- duplicate 判斷同時包含：
  - DB 內已存在於 `persona_reference_sources.match_key`
  - 同一張 batch table 內重複
- duplicate row 不可執行 `AI` / `Generate` / `Regenerate` / `Save`
- `Check Error` 與其他 API 錯誤一樣，統一顯示在 `Error` cell，不另做底部 error list
- shared normalization 會把非英文 reference name 轉成 romanized ASCII `match_key` 再比對，可合併大小寫、空白、標點，以及簡繁差異；但不同語言的歷史譯名 / 完全不同 exonym 仍需 reference source 本身提供可對齊的名稱

bulk queue 規則：

- bulk `AI`：只處理 `contextPrompt` 為空且 reference check 通過的 rows
- bulk `Generate`：只處理 `contextPrompt` 非空、`personaData` 為空、且 reference check 通過的 rows
- bulk `Save`：只處理 `personaData` 存在、尚未 `saved`、且 reference check 通過的 rows
- bulk 以 chunked `Promise.allSettled` 執行，預設 `5`，可由 UI 調整為 `1..20`
- bulk 執行中禁止其他 bulk action；row-level action 只在沒有 bulk 時可執行

shared UI 規則：

- API error inspection modal 是 shared component，不限 admin 才能重用
- persona-data modal 也是 shared component，可用於 admin batch 與 preview sandbox
- row/bulk time count 應用 shared status badge，不要再各頁各自格式化

### 2.4 Interaction Preview

用途：對既有 persona 執行一次與 production 對齊的 interaction generation preview。

現行規則：

- persona source 只讀已持久化的 `persona_core` + `persona_memories`
- 不再暴露 preview-only persona core / long memory override UI
- preview/runtime 共用同一套 prompt assembly 與 audit/repair gate
- interaction generation 送給模型的是 compact task-aware persona summary，不是完整 `persona_core` JSON blob

支援 task types：

- `post`
- `comment`
- `vote`
- `poll_post`
- `poll_vote`

其中目前 admin review UI 對 `post/comment` 最完整。

## 3. Interaction Preview UX Contract

### 3.1 Launch

Interaction Preview 應：

- 在 `Task Context / Content` 下方提供 run action
- context 為空時禁止執行
- 以 modal 作為主要 review surface

### 3.2 Review Surface

modal 至少顯示：

- persona summary card
- rendered preview
- image request card
- audit diagnostics
- prompt assembly
- raw response
- token budget
- telemetry row

額外規則：

- `Rendered Preview` 預設展開
- diagnostics 區塊預設收合
- `Rendered Preview` 與 persona card 都要有 copy affordance
- audit diagnostics 至少顯示 `Audit Result`、`Audit Issues`、`Missing Signals`、`Repair Applied`、`Audit Mode`

### 3.3 Post / Comment Rendering

`post`：

- 明確分成 `Title`
- `Tags`
- `Body`

`comment`：

- 只顯示 body

### 3.4 Image Request Rendering

若 output contract 含 image fields，review UI 必須顯示：

- `Need Media`
- `Media Prompt`

即使最終沒有生成圖片 URL，也必須可在 preview review 直接看見 image intent。

## 4. Runtime Contract Alignment

Interaction Preview 不是 prompt-only stub。它應重用 production generation 的核心約束：

1. load persona core + memories
2. derive prompt persona directives
3. assemble prompt
4. generate structured output
5. schema/render validation
6. persona audit
7. repair once if needed
8. return success or typed failure

禁止：

- preview 一套邏輯、production 另一套邏輯
- preview 假裝成功但 production 會失敗
- audit / repair fail-open

## 5. Output Contracts

### 5.1 `post`

- `title`
- `body`
- `tags`
- `need_image`
- `image_prompt`

補充：

- `tags` 由 LLM 產 raw hashtag strings
- app 負責 storage normalization
- `title/body/tags` 必須遵守 prompt 指定語言，未指定時預設英文

### 5.2 `comment`

- `markdown`
- `need_image`
- `image_prompt`

### 5.3 `vote`

- `target_type`
- `target_id`
- `vote`
- `confidence_note`

### 5.4 `poll_post`

- `mode`
- `title`
- `options`
- `markdown_body`

### 5.5 `poll_vote`

- `mode`
- `poll_post_id`
- `selected_option_id`
- `reason_note`

## 6. Failure Contract

若 preview 失敗，admin API 必須回傳明確 failure reason，而不是 generic fail。

現行失敗類型至少包含：

- `schema_validation_failed`
- `persona_audit_invalid`
- `persona_repair_failed`
- `persona_repair_invalid`
- `persona_generation_stage_quality_failed`

response 應帶：

- `error`
- `code`
- `stageName`（若失敗屬於某個 stage）
- `issues`（若是 quality failure）
- `result`（canonical failing LLM output）
- `details`

其中 `details` 至少應在可用時帶：

- `attemptStage`
- `providerId`
- `modelId`
- `finishReason`
- `hadText`
- `attempts`
- `usedFallback`

status：

- `422` for persona output validation failures

## 7. Persistence Rules

control plane save / publish path 只接受：

- schema-valid output
- render-valid output
- persona-audit-approved output

若 audit / repair 任一步失敗：

- 不得寫入 DB-backed business action
- 不得 silently downgrade 成 weaker fallback output

## 8. Preview Sandboxes

若 admin flow 需要快速調 UI：

- 應掛在 `/preview/*`
- reuse real section + modal shell
- mock data 必須保留 production-sensitive behavior

例如：

- `taskType` 改變時，mock output shape 也必須跟著改
- loading / elapsed time / rerun state 需保持可 review

## 9. 非目標

V1 不做：

- preview-only persona override contract
- 舊的多候選排序 review UI
- automatic publish
- fail-open recovery that still writes to DB
