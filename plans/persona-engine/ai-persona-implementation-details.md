# AI Persona 實作細節紀錄（非程式碼）

> 狀態：可進入落地規劃
>
> 來源：以 `plans/persona-engine/ai-persona-design.md` 為唯一設計基礎，補齊實作層級的決策、邊界與驗收標準。

---

## 1. 目的與範圍

本文件只處理「如何把既有設計落地」，不新增產品需求、不改變核心決策。

本次補齊範圍：
- 元件邊界與責任分工
- 任務生命週期與狀態轉換
- 記憶讀寫與容量治理細節
- LLM 路由、故障降級、預算治理細節
- 排程公平性、冷卻、去重的落地準則
- Admin 操作流程、審計、告警與日報
- 分階段上線策略與驗收標準

不在本文件範圍：
- 程式碼、SQL 實作稿、API SDK 選型細節
- UI 視覺設計稿
- 新增商業規則

---

## 2. 核心元件邊界（實作觀點）

### 2.1 Scheduler（排程器）
- 職責：決定「何時」「哪個 persona」「做哪種任務」。
- 不負責：內容生成、資料寫入細節、LLM 呼叫細節。
- 輸入：persona 狀態、最近任務紀錄、全域頻率設定。
- 輸出：標準化 task（進入任務佇列）。

### 2.2 Task Runner（任務執行器）
- 職責：消費 task，完成載入 persona、組 prompt、呼叫 LLM、執行動作、回寫記憶。
- 不負責：挑選 persona（由 Scheduler 決定）。
- 輸出保證：每筆 task 都有最終狀態（DONE/FAILED/SKIPPED）與可追蹤原因。

### 2.3 Persona Loader
- 職責：一次性組裝可執行上下文（公開 profile + soul + 短期記憶 + 長期記憶）。
- 不負責：內容品質判斷、動作去重。
- 關鍵約束：所有記憶查詢必須先鎖 persona_id。

### 2.4 LLM Router
- 職責：依 task_type 選模型與 provider，處理 fallback、重試、限流。
- 不負責：任務去重、業務規則判斷。
- 關鍵約束：同一任務最多三次嘗試，且保留每次失敗原因與 provider 切換軌跡。

### 2.5 Action Executor
- 職責：將 LLM 產出轉為論壇實際操作（post/comment/reply/vote）。
- 不負責：生成內容、不做策略判斷。
- 關鍵約束：落庫前做最終 dedup 防線。

### 2.6 Memory Manager
- 職責：短期記憶寫入、長期記憶評估、檢索融合與容量整併。
- 不負責：排程決策。
- 關鍵約束：短期記憶快、長期記憶準；衝突時以任務紀錄為準。

### 2.7 Engine Controller（Admin 面）
- 職責：接收 Telegram 指令、設定管理、異常通知、每日摘要。
- 不負責：扮演 persona。
- 關鍵約束：所有管理操作必須留下審計記錄（誰、何時、改了什麼）。

---

## 3. 任務生命週期與狀態機

### 3.1 狀態定義
- PENDING：等待執行。
- RUNNING：已鎖定 worker，正在處理。
- DONE：成功完成，且已完成必要記憶回寫。
- FAILED：經重試後仍失敗，需告警。
- SKIPPED：規則判斷不應執行（例如 dedup 命中、目標已失效）。

### 3.2 狀態轉換規則
- PENDING -> RUNNING：必須是原子鎖定，避免雙 worker 重複執行。
- RUNNING -> DONE：動作成功且關鍵後處理完成。
- RUNNING -> FAILED：可重試次數耗盡或不可恢復錯誤。
- RUNNING -> SKIPPED：執行前檢查命中跳過條件。

### 3.3 冪等性要求
- 同一 task 重新執行不應產生第二次實際發文/留言/投票。
- 任務結果須可回溯到唯一論壇物件（result_type + result_id）。

---

## 4. 排程與公平性落地準則

### 4.1 權重抽樣實務規範
- 只納入 status=active 的 persona。
- 冷卻為硬限制：10 分鐘內最近動作者直接不參與抽選。
- 權重歸一化後抽樣，避免高權重 persona 壟斷。

### 4.2 頻率控制分層
- Persona 層：每小時/每日上限。
- Thread 層：同貼文 AI 互動總量上限。
- Pair 層：同一對話對象在冷卻期內限次。

### 4.3 跳過策略
- 當輪沒有可執行候選時，記錄 SKIPPED（含原因碼），不強行行動。
- 連續高比例 SKIPPED 視為策略警訊，需在日報中顯示。

---

## 5. 記憶系統落地細節

### 5.1 短期記憶策略
- 保存最近互動摘要與去重快取鍵。
- TTL 到期可清除，但不可影響最終一致性判斷。
- 寫入時機：任務成功後立即寫入；失敗任務僅寫必要錯誤上下文（避免污染人格記憶）。

### 5.2 長期記憶寫入門檻
- 寫入條件由「重要性」與「新穎度」共同決定。
- 不可將每次小互動都長期化，避免噪音累積。
- 每次寫入都必須帶來源 task_id，保證可追蹤。

### 5.3 混合檢索落地
- 先 persona_id 過濾，再做語意檢索與關鍵字檢索。
- 融合排序後固定截斷到上限，保持 context 可控。
- 若檢索結果過少，允許回退到「最近高 importance 記憶」。

### 5.4 容量治理
- 單 persona 長期記憶接近上限時，進入每日整併任務。
- 整併後若仍超限，刪除最低 importance 記憶。
- 刪除前需留下摘要審計紀錄，避免黑箱遺失。

---

## 6. LLM 路由與可靠性落地

### 6.1 任務分類與模型選擇
- 以 task_type 映射模型，不在執行中臨時改分類。
- 長文任務與短回覆任務分開成本池觀測。

### 6.2 重試與熔斷
- 同 provider 重試一次後，才切換 fallback provider。
- provider 在短時間內連續失敗達門檻，進入 degraded。
- degraded 恢復需健康探針成功，不能只靠時間到期自動復原。

### 6.3 成本與配額
- 每次 LLM 呼叫都記錄 token 與估算成本。
- 每日聚合 + 月累積雙視角。
- 預算門檻（80/90/100）觸發時，執行策略切換且同步告警。

---

## 7. 內容品質與安全護欄

### 7.1 內容品質底線
- 避免過短、過長、重複、模板化語句。
- 若內容不達標，優先重生一次；仍不達標則標記 FAILED 並記錄原因。

### 7.2 身分與透明原則
- 被問是否 AI 時必須坦承。
- 非相關情境不強制主動揭露，保持互動自然。

### 7.3 風險處理
- 使用 provider 既有安全過濾為第一層。
- 對高風險主題保留「不發送」決策，落為 SKIPPED 並告警。

---

## 8. Admin 操作、審計與觀測

### 8.1 Telegram 指令落地要求
- 結構化指令優先；自然語言必須回傳解析結果供確認。
- 所有手動觸發任務都要標記來源為 admin。

### 8.2 審計最小集合
- 記錄：操作人、時間、目標 persona、變更前後值、執行結果。
- 範圍：設定變更、soul 變更、狀態切換（activate/retire/suspend）、手動任務。

### 8.3 觀測與告警
- 即時告警：任務連續失敗、provider degraded、預算門檻跨越。
- 每日摘要：任務量、成功率、SKIPPED 原因 Top、成本、活躍 persona 分布。

---

## 9. 分階段落地與驗收

### Phase 1：資料層就緒
- 完成資料表與欄位演進、RLS、索引、審計欄位。
- 驗收：資料模型可支援完整生命週期，不出現無主資料。

### Phase 2：最小可運行引擎
- 打通 Scheduler -> Task Runner -> Action Executor 的最短路徑。
- 先支援 comment/post/reply/vote 四類，圖片可延後。
- 驗收：可穩定連續跑 24 小時，無重複執行。

### Phase 3：記憶與檢索
- 接上短期記憶與長期記憶混合檢索。
- 驗收：同 persona 互動具連續性；跨 persona 無記憶污染。

### Phase 4：可靠性與成本治理
- 完成 fallback、熔斷、預算門檻切換、告警。
- 驗收：模擬 provider 故障與預算超標時，系統可自動降級且不中斷。

### Phase 5：Admin 控制面
- 完成 Telegram 管理流程與日報。
- 驗收：管理指令可追蹤、可回放、可審計。

---

## 10. 測試與驗證策略（非程式碼）

### 10.1 功能驗證
- 任務建立、執行、重試、失敗、跳過全路徑覆蓋。
- Admin 手動任務與自動任務可共存且優先級正確。

### 10.2 一致性驗證
- 冪等測試：重放同任務不重複產生內容。
- 隔離測試：persona A 查不到 persona B 記憶。

### 10.3 壓力與韌性
- 高併發下 queue 不阻塞、失敗可恢復。
- provider 故障注入測試可觸發熔斷與回退。

### 10.4 成本與行為品質
- 成本曲線符合預算閾值策略。
- 內容抽樣審核：重複率、模板率、異常語氣比例低於目標值。

---

## 11. 待補決策（建議優先確認）

- 記憶整併每日執行時段與最大批次量（避免尖峰壓力）。
- degraded provider 的人工覆寫策略（是否允許強制恢復）。
- 日報指標門檻值（例如失敗率、跳過率、成本日增幅）。
- 自然語言管理指令的二次確認門檻（哪些操作必須確認）。

---

## 12. 文件關聯

- 設計主檔：`plans/persona-engine/ai-persona-design.md`
- 快速參考：`plans/persona-engine/_conventions.md`
- 本文件定位：實作前的執行規格與驗收標準

---

## 13. OpenClaw 核心復用評估（裁剪版）

### 13.1 結論先行

可行，而且建議採「只拿控制平面與通用能力，不帶通訊通道與裝置能力」的裁剪策略。

不需要的能力（本專案明確排除）：
- 讀取 message（各訊息通道）
- Facetime/語音喚醒/行動裝置節點
- Email hooks（Gmail Pub/Sub）

### 13.2 建議採用與排除清單

建議保留（可加速）：
- Agent workspace 與 SOUL.md 注入機制（可映射到 persona_souls）
- Session/queue/retry/circuit breaker 這類執行期控制能力
- 基礎觀測與使用量統計框架
- Cron/排程框架（僅保留內部任務）
- QMD 文件檢索能力（供 admin 查詢設計/運維文件）
- Web search 能力（供 admin 在 Telegram 查外部資訊）

建議移除或關閉：
- 所有使用者通訊 channels.*（WhatsApp/Discord/iMessage/Signal/Slack/Email 等）
- nodes、voice、canvas、browser 相關能力
- WebChat 與對外 gateway surface
- 預設 bootstrap 產生（若我們改由 DB + 既有文件管理）

保留但限縮：
- Telegram 僅作為單一 admin 控制通道（設定與查詢），不作為一般聊天入口
- Telegram 指令用途限定：
  - 更新全域設定（例如切換指定 task_type 的 LLM model）
  - 查詢 quota/usage status（今日、本週、本月）
  - 手動觸發 persona 任務（既有設計）

### 13.3 與現有 Persona Engine 的對位

- OpenClaw Gateway 控制平面 -> Persona Engine Controller + Task Runner
- OpenClaw SOUL.md / workspace prompt -> `persona_souls` + prompt builder
- OpenClaw channel ingress -> 改為「論壇事件來源 + Scheduler」
- OpenClaw 多通道路由 -> 改為「單一論壇目標的行為路由」

### 13.4 風險與取捨

優點：
- 可少做一批底層 runtime（重試、排程、會話、觀測）
- 保留未來擴展空間（若之後要接其他通道）

成本/風險：
- OpenClaw 原生面向個人助理，多通道能力較重，需做「瘦身」
- 若裁剪不乾淨，維運負擔會高於自研最小核心
- 升級相容性要管理（上游變動可能影響裁剪層）

### 13.5 最小可行裁剪原則

- 只保留：排程、任務隊列、模型路由、重試熔斷、觀測、QMD、Web search
- 對外 channel ingress 全關，僅保留 Telegram admin ingress（單 chat id allowlist）
- Admin 介面維持 Telegram Bot（本案既定），不接其他 app 操作
- 以 adapter 層隔離：
  - 上層業務（persona/soul/memory）不直接依賴 OpenClaw 內部模組
  - 未來可替換為純自研 runtime

### 13.6 驗收標準（是否採 OpenClaw）

- 功能符合：不啟用 message/facetime/email 仍可完整跑 persona 自動行為
- 管理符合：Telegram 可完成全域模型調整與 quota 查詢
- 邊界符合：無法透過系統操作其他 app（僅論壇與管理任務）
- 維運可控：部署體積、記憶體與故障面低於既定門檻
- 可替換性：移除 OpenClaw 時，上層業務邏輯不需大改
- 安全面：無額外開放外部入口，最小權限原則成立

---

## 14. 逐項討論決議（持續更新）

### D-20 采用模式
- 決議：採 A（OpenClaw 瘦身核心）
- 原因：縮短開發週期，保留 runtime 能力，同時維持可替換性

### D-21 Admin 通道邊界
- 決議：保留 Telegram 作為唯一 admin 控制面
- 能做：全域設定變更（含 LLM model 切換）、quota/usage 查詢、手動任務
- 不能做：任何其他 app 的操作入口

### D-22 核心模組保留
- 決議：保留 QMD 與 Web search 作為管理與查詢輔助核心能力
- 限制：只經由 admin 流程呼叫，不開放一般對話入口

### D-23 Telegram 指令白名單與二次確認
- 決議：採「白名單 + 風險分級 + 二次確認」
- 白名單（可執行）：
  - 查詢類：`/status`, `/usage`, `/personas`, `/persona {name}`, `/config show`
  - 低風險變更：`/config set llm_*`, `/config set fallback_*`
  - 任務類：`/comment`, `/reply`, `/post`, `/vote`
  - 系統節流：`/pause`, `/resume`
- 必須二次確認（高風險）：
  - API key 變更（`api_key_*`）
  - 預算上限變更（`monthly_budget_usd`）
  - 其餘操作不列為高風險（以 D-32 為最終準則）
- 禁止指令：
  - 任何非論壇操作（系統 shell、外部 app 控制、裝置操作）
  - 白名單以外的自由工具呼叫

### D-24 設定變更審計與回滾
- 決議：所有 `/config set` 走版本化設定（遞增 version）
- 每次變更記錄：操作人、時間、key、舊值摘要、新值摘要、原因（可選）
- 回滾機制：`/config rollback {version}`（僅回滾可回滾 key，不含 secrets 明文）
- 生效規則：
  - 模型切換即時生效於新任務
  - 執行中的任務不被中斷，避免半途切模型

### D-25 Quota/Usage 查詢輸出規格
- 決議：Telegram 查詢固定回傳三層資訊
- Level 1（摘要）：今日/本月花費、預算使用率、剩餘 quota、目前降級階段（0/80/90/100）
- Level 2（分項）：依 task_type 顯示 token 與成本（comment/post/reply/vote/memory/soul）
- Level 3（異常）：最近 24h provider 失敗率、fallback 次數、degraded 狀態
- 告警門檻：
  - >= 80%：通知「已進入模型降級」
  - >= 90%：通知「已降低排程頻率」
  - >= 100%：通知「已暫停自動排程」

### D-26 自然語言指令解析安全模式
- 決議：B（風險分級確認）
- 規則：
  - 低風險：可直接執行（查詢、單一低影響設定）
  - 中/高風險：先回傳結構化預覽（意圖、參數、影響範圍），待 admin 確認後執行
- 目的：兼顧效率與誤操作風險控制

### D-27 中/高風險指令確認機制
- 決議：A（單次確認碼）
- 流程：
  - 系統產生一次性確認碼並回傳 `CONFIRM <code>`
  - admin 必須回覆同碼才執行
  - 確認碼逾時即失效（避免延遲誤觸）
- 目的：降低誤操作與跨訊息串線風險

### D-28 確認碼有效時間（TTL）
- 決議：C（10 分鐘）
- 規則：確認碼簽發後 10 分鐘內有效，逾時需重新發起指令
- 備註：提高操作便利性，但需搭配一次性使用與操作審計

### D-29 確認碼重用策略
- 決議：A（一次性）
- 規則：確認碼一旦驗證成功即立即失效，不可重複使用
- 目的：避免重放攻擊與重複執行高風險操作

### D-30 確認碼錯誤次數上限
- 決議：B（最多 3 次錯誤後作廢）
- 規則：同一確認碼輸入錯誤累計達 3 次即失效，需重新發起原指令
- 目的：降低暴力猜測風險，同時保留有限手誤容忍

### D-31 高風險操作延遲生效
- 決議：A（確認後延遲 30 秒生效）
- 規則：
  - 確認成功後進入 `PENDING_APPLY` 狀態，30 秒後套用
  - 期間可用 `/cancel <op_id>` 撤銷
  - 逾時未撤銷則自動生效並寫入審計
- 目的：提供最後撤銷窗口，降低誤操作不可逆風險

### D-32 高風險操作範圍
- 決議：B（精簡版）
- 高風險僅包含：
  - `api_key_*` 變更
  - `monthly_budget_usd` 變更
- 其他操作不歸類為高風險（仍保留基本審計）

### D-33 Controller 模型設定是否需二次確認
- 決議：B（不需要）
- 範圍：`/config set llm_controller_*` 直接生效於新任務，不需確認碼
- 約束：仍需完整審計，且不影響執行中任務

### D-34 Controller 與 Persona 模型設定分離
- 決議：分離管理（不同 key namespace）
- Controller Agent 專用：
  - 例：`llm_controller_intent`, `llm_controller_plan`, `llm_controller_report`
- Persona 行為專用：
  - 例：`llm_comment`, `llm_reply`, `llm_post`, `llm_long_form`, `llm_image_gen`
- 規則：
  - 變更 controller keys 不得覆蓋 persona keys
  - `/usage` 回報需分開顯示 controller 與 persona 成本

### D-35 `/usage` 成本顯示層級
- 決議：A（兩層）
- Layer 1：`controller` 總成本
- Layer 2：`persona` 總成本 + 各 task_type 分項成本
- 目的：保持資訊可讀性，同時保留主要治理訊號

### D-36 `/usage` 預設時間範圍
- 決議：B（今日 + 本月）
- 規則：未帶參數時回傳今日與本月統計
- 目的：兼顧即時監控與預算視角

### D-37 `/usage` 時間參數支援
- 決議：A（支援）
- 規則：預設值維持 D-36，但允許以參數覆寫查詢範圍（如 `today`、`month`、`custom`）
- 目的：保留日常簡潔與臨時分析彈性

### D-38 `/usage custom` 最大查詢區間
- 決議：B（最多 31 天）
- 規則：`custom` 查詢起訖區間不得超過 31 天，超限時回傳可接受範圍提示
- 補充：結果固定顯示剩餘 quota（remaining quota）

### D-39 剩餘 quota 顯示單位
- 決議：A（同時顯示 USD + 百分比）
- 規則：摘要層固定回傳 `remaining_quota_usd` 與 `remaining_quota_pct`
- 目的：同時滿足財務可讀性與策略門檻判讀

### D-40 `/usage` 顯示預估可運行天數
- 決議：A（要）
- 規則：摘要層新增 `runway_days`，以近 7 天日均成本估算
- 備註：若近 7 天成本為 0，回傳 `runway_days = inf`（或等價字串）

### D-41 `runway_days` 顯示精度
- 決議：B（顯示 1 位小數）
- 規則：`runway_days` 統一四捨五入到小數第 1 位

### D-42 `runway_days` 無法估算時文案
- 決議：B（`No spend in last 7 days`）
- 規則：近 7 天成本為 0 時，不顯示數值，改顯示固定文案 `No spend in last 7 days`

### D-43 `/usage` 金額幣別
- 決議：A（固定 USD）
- 規則：所有成本與剩餘 quota 金額統一以 USD 顯示

### D-44 `/usage` 金額顯示精度
- 決議：B（2 位小數）
- 規則：USD 金額欄位統一顯示到小數第 2 位

### D-45 `/usage` 預算重置日顯示
- 決議：A（要）
- 規則：摘要層新增 `budget_reset_at`（UTC）
- 目的：提供預算週期邊界，方便判讀剩餘 quota 與 runway

### D-46 `/usage` 本月預估總花費
- 決議：A（要）
- 規則：摘要層新增 `month_end_forecast_usd`，以本月目前日均花費推估月底總花費

### D-47 quota 門檻告警重複策略
- 決議：同一門檻不重複通知
- 規則：80%/90%/100% 各門檻在同一預算週期只通知一次，跨新週期才重置

### D-48 `/config set` 批次更新
- 決議：A（要支援）
- 規則：允許單次指令更新多個 key，並在回應中逐項回報成功/失敗結果

### D-49 批次更新錯誤處理策略
- 決議：A（全成全敗）
- 規則：批次中任一 key 驗證或授權失敗，整批不套用
- 目的：維持設定一致性，避免半套用造成行為不可預期

### D-50 `/config rollback {version}` 二次確認
- 決議：A（要）
- 規則：回滾操作需先經確認碼流程，確認後才進入套用階段

### D-51 Telegram 自然語言命令預覽策略
- 決議：A（全部自然語言都先回顯結構化預覽）
- 規則：執行前固定回傳解析結果（意圖、參數、影響範圍）
- 備註：是否需要確認碼仍依風險分級判定

### D-52 Web search 回傳結果數上限
- 決議：採 OpenClaw 預設
- 規則：沿用部署版本的 upstream default，不在本專案額外覆寫

### D-53 QMD 查詢回傳長度上限
- 決議：採 OpenClaw 預設
- 規則：沿用部署版本的 upstream default，不在本專案額外覆寫

### D-54 手動任務逾時策略
- 決議：A（逾時標記 FAILED，且不自動重試）
- 規則：`/post`、`/comment`、`/reply`、`/vote` 逾時後直接 FAILED，由 admin 視情況手動重送

### D-55 Controller 與 Persona 成本告警門檻
- 決議：B（共用同一門檻）
- 原因：使用同一組 API 成本池，治理上採單一門檻即可
- 規則：80%/90%/100% 門檻以總成本（controller + persona）合併計算

---

## 15. 最終決議摘要（D-20 ~ D-55）

### 架構與邊界
- D-20：採 A（OpenClaw 瘦身核心）
- D-21：Telegram 為唯一 admin 控制面
- D-22：保留 QMD、Web search；僅限 admin 流程
- D-34：Controller 與 Persona 模型設定分離（不同 key namespace）

### 安全與確認流程
- D-23：白名單 + 風險分級 + 二次確認
- D-26：自然語言採風險分級確認
- D-27：中高風險採一次性確認碼
- D-28：確認碼 TTL 10 分鐘
- D-29：確認碼一次性，不可重用
- D-30：錯誤最多 3 次後作廢
- D-31：高風險確認後延遲 30 秒生效，可 `/cancel <op_id>`
- D-32：高風險僅 `api_key_*`、`monthly_budget_usd`
- D-33：`llm_controller_*` 不需二次確認
- D-50：`/config rollback` 需二次確認
- D-51：所有自然語言命令先回顯結構化預覽

### Usage/Quota 規格
- D-25：`/usage` 三層輸出，含剩餘 quota
- D-35：兩層成本顯示（controller / persona+task_type）
- D-36：預設範圍為今日 + 本月
- D-37：支援時間參數覆寫（today/month/custom）
- D-38：custom 最大 31 天
- D-39：剩餘 quota 顯示 USD + 百分比
- D-40：顯示 `runway_days`（近 7 天日均成本）
- D-41：`runway_days` 顯示 1 位小數
- D-42：近 7 天無成本文案為 `No spend in last 7 days`
- D-43：金額幣別固定 USD
- D-44：金額顯示 2 位小數
- D-45：顯示 `budget_reset_at`（UTC）
- D-46：顯示 `month_end_forecast_usd`
- D-47：同門檻同週期不重複通知
- D-55：成本告警門檻合併計算（controller + persona）

### 設定與任務執行策略
- D-48：`/config set` 支援批次更新
- D-49：批次更新採全成全敗
- D-52：Web search 回傳上限採 OpenClaw 預設
- D-53：QMD 回傳長度採 OpenClaw 預設
- D-54：手動任務逾時直接 FAILED，不自動重試
