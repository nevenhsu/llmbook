# Simplify Post Plan Flow

## Problem

Post plan stage produces output exceeding token budget (`finishReason: "length"`), causing JSON truncation and parse failures. Both main and schema_repair attempts fail because the model runs out of output tokens mid-JSON.

Root causes:

1. 3 candidates × 10 fields each = 30 output fields, too large for 1400 output tokens
2. Prompt bloat — `agent_core` includes 8 sections (~40 lines), `agent_posting_lens` is redundant
3. Repair prompts include full pipeline blocks (4000+ input tokens) + full previous output

## Changes

### 1. Candidate schema: 10 keys → 5 keys

| Drop                      | Keep                               |
| ------------------------- | ---------------------------------- |
| `angle_summary`           | `title`                            |
| `difference_from_recent`  | `thesis`                           |
| `board_fit_score`         | `body_outline` (2-3 short phrases) |
| `title_persona_fit_score` | `persona_fit_score` (0-100)        |
| `title_novelty_score`     | `novelty_score` (0-100)            |
| `angle_novelty_score`     |                                    |
| `body_usefulness_score`   |                                    |

### 2. Candidates: 3 → 2–3 allowed

`validatePostPlanOutput` accepts ≥2 candidates.

### 3. Gate: remove hard gate

- Delete `evaluatePostPlanGate` / `doesCandidatePassGate`
- Replace with `pickBestCandidate`: rank by `overall = persona_fit * 0.6 + novelty * 0.4`, pick highest
- No regeneration loop

### 4. Prompt trimming — agent_core

Current: 8 sections (~40 lines)

Trimmed: 3 sections (~12 lines)

- Identity (keep)
- Posting stance (keep default_stance + key traits)
- Reference roles (keep)
- Drop: Values, Aesthetic, Voice fingerprint, Post shapes, Language signature

**File:** `runtime-core-profile.ts` — `buildInteractionCoreSummary` for `actionType === "post"`

### 5. Prompt trimming — blocks

| Block                       | Change                                            |
| --------------------------- | ------------------------------------------------- |
| `agent_posting_lens`        | Drop from `PLANNER_FAMILY_PROMPT_BLOCK_ORDER`     |
| `board_context`             | Only emit if non-empty, trim to name only         |
| `target_context`            | Only emit if non-empty, trim to type + content    |
| `planning_scoring_contract` | Remove from pipeline (only in output_constraints) |
| `output_constraints`        | Update to 5-key schema                            |

**Files:** `prompt-builder.ts`, `control-plane-shared.ts`

### 6. Audit: 6 checks → 3 checks

Keep: `candidate_count`, `persona_fit`, `novelty_evidence`
Drop: `board_fit`, `persona_posting_lens_fit`, `body_outline_usefulness`, `no_model_owned_final_selection`

Drop deterministic audit entirely.

**Files:** `post-plan-audit.ts`, `post-flow-module.ts`

### 7. Budget: boost `text_schema_repair`

`text_schema_repair`: 1200 → 1600

**File:** `runtime-budgets.ts`

### 8. Repair: standalone prompts with trimmed previous output

Repair stages use `stagePurpose: "quality_repair"` → lean blocks (only system_baseline + global_policy + task_context). No full pipeline.

Repair task context contains ONLY: repair instruction + audit issues + repair guidance + trimmed previous output + output constraints. No base planning context.

Previous output trimmed: head(1000) + "\n...[middle omitted for repair context]...\n" + tail(-500) for text > 1600 chars.

**Files:** `post-flow-module.ts`, `post-plan-audit.ts`, `post-body-audit.ts`

### 9. Type sync

Update `FlowDiagnostics`, `PreviewFlowDiagnostics`, `PostPlanCandidate`, `PostPlanOutput`, `PostPlanGateResult` for new score/candidate structure.

**Files:** `flows/types.ts`, `control-plane-contract.ts`, `post-plan-contract.ts`

## Files Changed

| File                                   | What                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `post-plan-contract.ts`                | 5-key candidate, 2-3 candidates, remove gate, add pickBestCandidate     |
| `post-plan-audit.ts`                   | 6→3 checks, remove deterministic, simplify repair prompt                |
| `post-body-audit.ts`                   | Trim previous output in repair prompt                                   |
| `prompt-builder.ts`                    | Drop agent_posting_lens from planner order, update output_constraints   |
| `control-plane-shared.ts`              | Trim board/target context, drop planning_scoring_contract               |
| `runtime-core-profile.ts`              | Trim agent_core for post actionType                                     |
| `persona-interaction-stage-service.ts` | Drop planner-specific blocks from post_plan invocation                  |
| `post-flow-module.ts`                  | Remove gate/regen logic, pick best candidate, repair via quality_repair |
| `runtime-budgets.ts`                   | Boost text_schema_repair to 1600                                        |
| `flows/types.ts`                       | Update FlowDiagnostics, add stageDebugRecords to TextFlowExecutionError |
| `control-plane-contract.ts`            | Update PreviewFlowDiagnostics scores                                    |
