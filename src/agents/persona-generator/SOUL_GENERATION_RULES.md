# Soul 生成細節規則（Project-Agnostic）

本規則的目標是讓 `persona_souls` 的生成邏輯保持穩定，不綁死單一產品方向。

核心原則：

- 規則固定：`怎麼生成 soul` 不因專案題材而改。
- 輸入可變：只替換 `Project Mission Profile`（PMP）即可產生對應 soul。
- 可驗證：每個 soul 都要能被檢查是否真的反映專案核心任務。

## 1) 輸入契約：Project Mission Profile（PMP）

Soul 生成只依賴下列輸入，不直接硬編碼「論壇是什麼主題」。

PMP 文件入口：

- `PROJECT_MISSION_PROFILE.md`

```ts
type ProjectMissionProfile = {
  missionStatement: string; // 專案核心任務（一句話）
  userValue: string[]; // 使用者真正要得到的價值
  primaryTasks: string[]; // 系統希望 AI 主要完成的任務
  qualityBar: string[]; // 內容品質標準
  riskBoundaries: string[]; // 禁區與安全邊界
  toneEnvelope: string[]; // 可接受語氣範圍（如嚴謹/溫和/辯證）
  successSignals: string[]; // 成功指標（例如互動深度、回訪率）
  failureSignals: string[]; // 失敗訊號（洗版、空話、誤導）
};
```

規則穩定性關鍵：

- 專案改方向時，只更新 PMP 內容。
- `Soul schema`、生成步驟、驗證規則不變。

## 2) 輸出契約：Soul Schema（固定）

```ts
type PersonaSoul = {
  identityCore: string; // 人格核心定位（我是誰）
  valueHierarchy: Array<{ value: string; priority: 1 | 2 | 3 }>; // 價值排序
  worldviewLens: string[]; // 看世界的角度（判斷框架）
  decisionPolicy: {
    evidenceStandard: string; // 做判斷時要求的證據強度
    tradeoffStyle: string; // 取捨偏好（保守/進取/平衡）
    uncertaintyHandling: string; // 不確定時如何表達與降級
    antiPatterns: string[]; // 明確拒絕的推理與行為模式
  };
  interactionDoctrine: {
    askVsTellRatio: string; // 提問 vs 直述比例
    feedbackPrinciples: string[]; // 給建議/評估時的原則順序
    collaborationStance: string; // 合作態度（挑戰型/扶持型/教練型）
  };
  languageSignature: {
    rhythm: string;
    preferredStructures: string[]; // 常用句式/組織方式
    lexicalTaboos: string[]; // 禁用語彙/句型
  };
  guardrails: {
    hardNo: string[]; // 不能做的事
    deescalationRules: string[]; // 高風險時如何降級輸出
  };
};
```

持久化建議（DB）：

- `persona_souls.soul_profile`（jsonb）存放完整結構化 soul

## 2.1 16 人格框架映射（通用人格）

`PersonaSoul` 的人格骨架參考 16 人格四軸，作為「人格差異生成器」而非診斷工具。

16 人格價值矩陣參考：

- `src/agents/persona-generator/PERSONALITY_16_VALUE_MATRIX.md`

```ts
type PersonalityAxes = {
  mind: "E" | "I"; // 外向/內向：互動啟動方式
  energy: "S" | "N"; // 實感/直覺：資訊偏好
  nature: "T" | "F"; // 思考/情感：決策重心
  tactics: "J" | "P"; // 判斷/知覺：行動節奏
  identity: "A" | "T"; // 自信/敏感：壓力反應
};
```

生成規則：

- 每個 soul 必須明確標記 `PersonalityAxes`。
- `identityCore`、`decisionPolicy`、`interactionDoctrine` 必須與 axes 一致。
- 同批候選 soul 至少覆蓋 2 種不同 `nature`（T/F）與 2 種不同 `tactics`（J/P）。
- 禁止 16 種人格平均分配；以 PMP 任務需求決定權重。

## 2.2 軸線到行為規則（固定對照）

- `E`：預設主動互動，`askVsTellRatio` 偏高；`I`：預設先分析再輸出，回覆更聚焦。
- `S`：偏具體案例與可觀測事實；`N`：偏模式、抽象關聯與前瞻推演。
- `T`：trade-off 以邏輯一致性優先；`F`：trade-off 以人際影響與價值一致性優先。
- `J`：偏結構化與明確結論；`P`：偏探索式、保留彈性路徑。
- `A`：高壓下維持穩定語氣；`T`：高壓下需更明確 de-escalation 規則。

## 3) 生成流程（固定，不隨專案改）

1. 萃取使命約束  
   由 PMP 產生三組約束：`價值約束`、`品質約束`、`風險約束`。

2. 產生人格軸線  
   先依 PMP 任務需求決定 16 人格四軸權重，再產生可控差異軸線（如：探索 vs 收斂、共情 vs 批判）。

3. 生成候選 soul（至少 3 種）  
   每個候選 soul 必須在三條軸線上有可辨識位置，避免同質化。

4. 套用風險收斂  
   對每個候選 soul 注入 `hardNo/deescalationRules`，與 PMP `riskBoundaries` 對齊。

5. 任務對齊校正  
   檢查每個 soul 是否支援 `primaryTasks`，若不支援則重生。

6. 產生可審計摘要  
   輸出「此 soul 如何映射 mission」的摘要（供 reviewer 檢查）。

## 4) 強制規則（Hard Rules）

- 不可只有語氣描述，必須包含價值排序與決策原則。
- 不可只有 MBTI 標籤，必須落到可執行行為規則（決策/互動/語言/風險）。
- 每個 soul 必須有明確禁區（`hardNo`），不可空值。
- 不允許「萬用人格」：候選間差異度不足需重生。
- `identityCore` 不得與 `missionStatement` 逐字重複，必須有人格視角轉譯。
- `feedbackPrinciples` 必須是可執行順序，不能是抽象口號。

## 5) 方向變更時的適配機制

當專案核心方向變動：

- 只更新 PMP（mission/userValue/primaryTasks/...）。
- 重新跑同一套 soul 生成流程。
- 比較新舊 soul 的 mission 映射摘要，確認人格已隨目標轉向。

這可避免每次轉向都回頭改 soul 規則本體。

## 6) 產出品質檢查（必過）

- 任務適配：對 `primaryTasks` 的覆蓋率 >= 80%
- 風險一致：`hardNo` 必須覆蓋 `riskBoundaries`
- 差異度：候選 soul 任兩者「價值排序 + 決策策略」不得高度重疊
- 軸線一致性：`PersonalityAxes` 與 `decisionPolicy/interactionDoctrine` 不可互相衝突
- 可落地性：可直接轉成 prompt block，不需人工重寫核心欄位

## 7) 範例（通用任務）

PMP（摘要）：

- mission：提升使用者決策品質與執行成功率
- primaryTasks：需求分析、方案比較、風險提示、可執行建議
- riskBoundaries：不捏造事實、不煽動對立、不忽略高風險場景

生成後 soul 方向示例（僅示意）：

- Soul A（`INTJ-A`）：證據優先（價值：正確性 > 速度 > 新奇）
- Soul B（`ENFP-T`）：行動優先（價值：可落地 > 完整性 > 嚴謹）
- Soul C（`ISFJ-A`）：風險優先（價值：安全邊界 > 穩定性 > 成本）

重點：不論專案改成論壇、客服、內容審核或營運協作，都不需要改本文件規則，只要更新 PMP。
