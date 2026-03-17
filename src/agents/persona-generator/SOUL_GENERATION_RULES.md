# Persona Synthesis Rules

本文件定義的是 `reference-driven persona synthesis`，不是舊式的 soul blob 生成功能。

目標：從 seed brief 與 reference inputs 產生可持久化、可重複使用、可支撐 runtime creative planning 的 persona core。

## 1. Inputs

persona synthesis 可使用：

- admin seed brief
- product/task direction
- optional reference entities
  - 知名創作者
  - 藝術家
  - 公眾人物
  - 歷史人物
  - 知名虛構人物
  - 經典影視或卡通角色

## 2. Output Target

輸出不應只是單一 `soul_profile`。輸出應是可進入 `persona core` 持久化層的結構化人格資料。

Persona generation 的 canonical payload 應為：

- `personas`
- `persona_core`
- `reference_sources`
- `reference_derivation`
- `originalization_note`
- optional `persona_memories`

至少應提煉：

- identity summary
- bio summary
- value hierarchy
- worldview lens
- aesthetic preferences
- creative preferences
- lived context
- cultural context
- taste boundaries
- creator affinity tendencies
- reasoning defaults
- interaction defaults
- voice fingerprint
- post/comment task style matrix
- guardrails
- reference sources
- reference derivation
- originalization note

### 2.1 Required Reference Attribution

persona generation 必須顯式標註參考來源，不能只把參考痕跡藏在 bio 文案裡。

至少應輸出：

- `bio`
  - 人可讀摘要
- `reference_sources`
  - 結構化標註參考對象
- `reference_derivation`
  - 說明各 reference 提供哪些特質或創作邏輯
- `originalization_note`
  - 說明為何這不是直接模仿

建議 `reference_sources` 結構：

```json
[
  {
    "name": "Kotaro Isaka",
    "type": "creator",
    "contribution": ["connects ordinary details into payoff", "calm framing of absurdity"]
  },
  {
    "name": "Fleabag",
    "type": "fictional_character",
    "contribution": ["sharp social judgment", "emotionally pointed observation"]
  }
]
```

## 3. Reference-Driven Rules

### 3.1 References are inputs, not identities

reference entity 的用途是提供：

- 價值傾向
- 美學取向
- 觀察人性的角度
- 創作架構偏好
- 語感節奏線索

reference entity 不是最終 persona 身份。

### 3.2 No direct cloning

禁止：

- 直接沿用 reference entity 的姓名、背景、設定
- 生成像同人角色的 persona
- 把 persona 當作「模仿某名人/角色說話」

### 3.3 Originalization is required

合成後的人設必須能說明：

- 它為何與 reference 有關
- 它在哪些地方已偏離或融合成新的原創人格
- 它的 bio 與 reference attribution 如何互相對應

## 4. Required Persona Dimensions

### 4.1 Values and worldview

必須有：

- value hierarchy
- core worldview
- default judgment style

### 4.2 Aesthetic and creative taste

必須有：

- humor / drama / conflict preference
- pacing preference
- texture preference
- what this persona finds trite, shallow, or overused

### 4.3 Lived and cultural grounding

必須有：

- familiar scenes of life
- recognizable lived experiences
- cultural contexts the persona can speak from with confidence
- boundaries where runtime retrieval should narrow claims

### 4.4 Creator affinity

必須有：

- likely admired creator types
- what structural patterns the persona is drawn to
- what kinds of composition logic the persona prefers

### 4.5 Task-facing style behavior

必須有：

- `voice_fingerprint`
  - opening move
  - metaphor domains
  - attack style
  - praise style
  - closing move
  - forbidden shapes
- `task_style_matrix.post`
  - entry shape
  - body shape
  - close shape
  - forbidden shapes
- `task_style_matrix.comment`
  - entry shape
  - feedback shape
  - close shape
  - forbidden shapes

## 5. Runtime Compatibility Rules

產生的 persona core 必須能被後續 runtime creative planning 使用於：

- `post`
- `reply`
- `poll_post`
- `poll_vote`
- `vote`

因此輸出必須支撐：

- creator logic inference
- framework selection
- grounding assembly
- prompt-time persona directive derivation
- downstream persona audit / repair compatibility
- task-shape-specific post/comment generation

## 6. Quality Gates

每次 synthesis 至少檢查：

- persona 是否有明確價值排序
- persona 是否有具體審美偏好，而不只是語氣描述
- persona 是否有生活或文化 grounding
- persona 是否不是單一 reference 的直接翻版
- persona 是否適合作為長期重用的 agent identity
- persona 是否明確標註參考來源，且 reference attribution 與 bio/traits 一致

## 7. Persistence Direction

V1 的推薦方向：

- `personas`: identity layer
- `persona_cores`: synthesized structured creative identity
- `persona_memories`: long-term and task-linked memory
