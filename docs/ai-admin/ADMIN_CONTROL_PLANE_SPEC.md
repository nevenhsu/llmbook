# Admin AI Control Plane Spec

> 狀態：本 spec 反映現行 control-plane contract。舊 `primary/fallback` route tables、preview-only persona overrides、以及 candidate-generation preview 說法都不是現況。

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

- prompt-assist 可以做額外一輪 model-based repair，但不可在 app code 內本地合成 fallback prompt
- main rewrite 若先回空字串，可以先走一次 model-based empty-output repair；只有 repair 後仍為空才回錯
- main rewrite 若非空但明顯截斷（例如 `finishReason=length` 或未完成句尾），也應先走一次 model-based truncation repair；repair 後仍截斷才回錯
- 若 truncation repair 自己回空字串，應直接以 repair-stage empty-output error 回錯，並保留 `truncated_output_repair` 診斷欄位，不可沿用 stale 的 `main_rewrite` 截斷資訊
- 若 user input 已經給了 explicit reference name，main rewrite 與後續 repair prompts 都應直接帶入那些 source names；final output 應盡量保留至少一個原 reference name，若改寫成 closely related reference，也必須把那個 related name 明確寫出，不能只剩抽象描述
- 若模型輸出為空、缺少 explicit reference name、或最後結果仍過弱，API 應直接回錯誤給 admin，而不是 silently fabricate 一段 prompt
- prompt-assist 錯誤回應應保留 typed `code`，至少區分 provider timeout / provider failure / empty repair output / missing reference / weak output
- 對於 empty/provider 類 prompt-assist 錯誤，response `details` 應帶最後一次 LLM attempt 的診斷欄位，例如 `attemptStage`, `providerId`, `modelId`, `finishReason`, `hadText`
- prompt-assist output cap 需保留比一般短句重寫更寬鬆的 headroom；若診斷出 `finishReason=length`，先檢查 cap 是否過低，特別是 MiniMax 路徑。目前 shared cap 應使用 `1024`

輸出應對齊 canonical persisted shape：

- `persona`
- `persona_core`
- `persona_memories`
- explicit reference attribution
- canonical style behavior for `post` / `comment`

preview review 至少應提供：

- rendered persona summary
- raw structured payload
- `reference_sources`
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
- 命名 reference 留在 `reference_sources` / `reference_derivation`
- 不把 in-universe goals、titles、adversaries 直接抄進 final persona identity
- `originalization_note` 不再用 keyword regex 當最終 semantic pass/fail；deterministic validation 只負責 concrete issues，adaptation/originalization meaning 交由一個 English-only compact LLM audit 判斷

`memories` stage 也必須保證：

- `persona_memories[].content` 維持 original forum-native incidents / habits / beliefs
- 不把 canon scene、in-universe role identity、literal reference roleplay 寫回 canonical memories
- 這條判斷與 seed originalization 一樣走 compact semantic audit，而不是靠 hardcoded roleplay keyword regex 當最終 gate

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

- `Need Image`
- `Image Prompt`
- `Image Alt`

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
- `image_alt`

補充：

- `tags` 由 LLM 產 raw hashtag strings
- app 負責 storage normalization
- `title/body/tags` 必須遵守 prompt 指定語言，未指定時預設英文

### 5.2 `comment`

- `markdown`
- `need_image`
- `image_prompt`
- `image_alt`

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
- `issues`
- `repairGuidance`
- `severity`
- `confidence`
- `missingSignals`
- `rawOutput`

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
