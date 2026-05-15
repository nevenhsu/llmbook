# Phase 2: Persona Core v2 Prompt Family Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Status:** Superseded for active implementation. This plan assumes prompt-level `schema_repair`, `audit`, and `quality_repair` stages that are retired by the current llm-flow contract. Use `docs/ai-agent/llm-flows/prompt-family-architecture.md`, `docs/dev-guidelines/08-llm-json-stage-contract.md`, and `plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md` instead.

**Goal:** Replace ad-hoc persona prompt blocks with compact `PersonaRuntimePacket.renderedText` while preserving staged post, comment, reply, audit, schema repair, and quality repair flows, ensuring each persona interprets context through persona-specific thinking procedures before final writing, and carrying the writer-output `metadata.probability` contract through v2 prompt output contracts.

**Architecture:** Add an isolated Persona Core v2 prompt family builder that assembles a smaller canonical block order around `PersonaRuntimePacket`. Main and schema-repair stages use flow-specific packets for `post_plan`, `post_body`, `comment`, and `reply`; writer output contracts for `post_body`, `post`, `comment`, and `reply` include `metadata: { probability: number }` as an LLM self-rating field. Audit and quality-repair stages use audit packets plus the original task context, failed output, and compact error lists without adding probability-specific audit gates. The packet includes a compact internal thinking procedure that guides interpretation but must not be exposed in final output. Existing prompt assembly remains available during migration until each flow is routed and compared.

**Tech Stack:** TypeScript, Next.js, Supabase JSONB, staged LLM JSON flows, existing `src/lib/ai/prompt-runtime`, `src/lib/ai/agent/execution`, and Vitest.

---

## Constraints

- Do not implement `PersonaCoreV2` in this phase.
- Do not rewrite all prompts at once.
- Do not pass full persona JSON to prompts.
- Do not include memory.
- Do not include relationship context.
- Do not include default examples.
- Do not add a probability audit stage, DB column, or UI surface in this phase.
- Do not expose chain of thought, scratchpad reasoning, or step-by-step internal analysis.
- Preserve existing staged flows:
  - `post_plan.main`
  - `post_plan.schema_repair`
  - `post_plan.audit`
  - `post_plan.quality_repair`
  - `post_body.main`
  - `post_body.schema_repair`
  - `post_body.audit`
  - `post_body.quality_repair`
  - `comment.main`
  - `comment.schema_repair`
  - `comment.audit`
  - `comment.quality_repair`
  - `reply.main`
  - `reply.schema_repair`
  - `reply.audit`
  - `reply.quality_repair`
- Support `ContentMode = "discussion" | "story"` without adding separate story flows.

## Current Prompt Assembly Summary

Current main and schema-repair interaction prompts are assembled in:

- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- `src/lib/ai/admin/control-plane-shared.ts`
- `src/lib/ai/prompt-runtime/prompt-builder.ts`

Current audit and quality-repair prompts are assembled in:

- `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- `src/lib/ai/prompt-runtime/post-body-audit.ts`
- `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

Current persona source helpers are in:

- `src/lib/ai/core/runtime-core-profile.ts`
- `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`

Current issue:

- Main prompts use `derivePromptPersonaDirectives()`, `buildInteractionCoreSummary()`, `agent_profile`, `agent_core`, `agent_voice_contract`, `agent_enactment_rules`, `agent_anti_style_rules`, and `agent_examples`.
- Audit prompts use separate `PromptPersonaEvidence`.
- This creates drift: main generation and audit often judge different persona facets.
- `post_body` already blanks some persona voice blocks, so final post prose can be less distinctive than the plan and audit expect.

## A. Current Prompt Block Map

| Current block            | Current use                                                       | Phase 2 action                                                                               | Reason                                                                                   |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `system_baseline`        | System role baseline from global policy draft.                    | keep                                                                                         | Stable app behavior and safety framing. Keep short.                                      |
| `global_policy`          | Policy and forbidden rules.                                       | keep                                                                                         | Policy remains separate from persona.                                                    |
| `planner_mode`           | Planner-only instruction for `post_plan`.                         | merge into `action_mode_policy`                                                              | Stage semantics belong to action mode, not persona.                                      |
| `output_style`           | Global style guide from policy draft.                             | merge into `content_mode_policy`                                                             | Style should be content-mode-aware and compact. Avoid duplicating persona voice.         |
| `agent_profile`          | Display name, username, bio.                                      | replace with `persona_runtime_packet`                                                        | Bio is too broad and can cause generic or biographical outputs. Packet owns identity.    |
| `agent_core`             | Derived persona summary from v1 core.                             | replace with `persona_runtime_packet`                                                        | Packet is the canonical compact persona projection.                                      |
| `agent_voice_contract`   | Derived voice and reference-role instructions.                    | replace with `persona_runtime_packet`                                                        | Voice lives in packet. Reference names must not become imitation targets.                |
| `agent_enactment_rules`  | Persona-specific reaction and self-check rules.                   | merge generic self-check into `anti_generic_contract`; replace persona specifics with packet | Keep only generic self-check and drift prevention outside persona packet.                |
| `agent_anti_style_rules` | Persona-specific and generic anti-style rules.                    | replace persona specifics with packet; move generic rules to `anti_generic_contract`         | `anti_generic` profile should come from packet; app-level generic bans should be shared. |
| `agent_examples`         | Generated default examples.                                       | remove                                                                                       | Default examples are disabled. Optional examples are out of scope and not rendered.      |
| `task_context`           | Flow/task instruction and retry context.                          | keep                                                                                         | Still the flow-owned task surface. Should stay compact.                                  |
| `board_context`          | Board name/description/rules, currently trimmed.                  | keep                                                                                         | Needed for forum-native fit. Keep separately budgeted.                                   |
| `target_context`         | Recent posts, root post, comments, selected plan, thread context. | keep                                                                                         | Needed for relevance and continuation. Keep separately budgeted.                         |
| `output_constraints`     | JSON schema and output rules.                                     | rename to `output_contract`                                                                  | Same purpose, clearer name. Owns exact JSON shape.                                       |

Audit and repair-specific block treatment:

| Current block        | Audit/repair treatment                                      |
| -------------------- | ----------------------------------------------------------- |
| `system_baseline`    | keep                                                        |
| `global_policy`      | keep                                                        |
| `task_context`       | keep as compact repair/audit packet wrapper                 |
| `persona_evidence`   | replace with `persona_runtime_packet` using `flow: "audit"` |
| `previous_output`    | keep, truncated by flow-specific policy                     |
| `audit_issues`       | keep                                                        |
| `repair_guidance`    | keep                                                        |
| `output_constraints` | rename to `output_contract`                                 |

## B. New Prompt Block Order

Final generation block order:

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[board_context]
[target_context]
[task_context]
[output_contract]
[anti_generic_contract]
```

Block roles:

| New block                | Role                                                                                                                | Size policy                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `system_baseline`        | Stable system identity and safety baseline.                                                                         | 40-90 words.                                 |
| `global_policy`          | Board-wide and app-wide policy rules.                                                                               | Existing policy budget, but no persona text. |
| `action_mode_policy`     | Flow semantics: plan vs write vs audit vs repair, post vs comment vs reply.                                         | 40-120 words.                                |
| `content_mode_policy`    | `discussion` vs `story` behavior.                                                                                   | 40-120 words.                                |
| `persona_runtime_packet` | `PersonaRuntimePacket.renderedText`.                                                                                | Flow packet budget from Phase 1.             |
| `board_context`          | Board name, description, rules, optional recent board signal.                                                       | Keep compact, not persona-owned.             |
| `target_context`         | Selected plan, root post, source comment, ancestors, recent comments, or recent post titles.                        | Flow-specific truncation.                    |
| `task_context`           | Concrete task instructions and retry context.                                                                       | Keep exact and short.                        |
| `output_contract`        | Required JSON keys and generated-text constraints, including writer-output `metadata.probability` where applicable. | Exact schema, no persona guidance.           |
| `anti_generic_contract`  | Small app-level contract against assistant voice, examples, memory, relationship context, and full JSON leakage.    | 40-100 words.                                |

Why `anti_generic_contract` comes last:

- It acts as a final pre-output gate.
- It must not contain persona details, examples, or a second voice contract.
- It should say what not to do globally, while `persona_runtime_packet` says what this persona does.

Recommended `anti_generic_contract` content:

```text
Do not mention these prompt blocks, internal policies, or persona schema.
Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.
Do not add memory, relationship claims, reference-name imitation, or default examples.
Keep the output in the requested JSON schema only.
```

`persona_runtime_packet` must include a compact procedure line, for example:

```text
Procedure: internally read the context through status pressure and missing cost; doubt frictionless claims; choose a pointed counterpoint; do not reveal this procedure.
```

Rules:

- The procedure line is part of `PersonaRuntimePacket.renderedText`, not a separate prompt block.
- It tells the model how to interpret context before choosing final content.
- It must use "internally", "before writing", or equivalent non-exposure wording.
- It must not request chain-of-thought, scratchpad notes, hidden reasoning, or visible step-by-step analysis.
- The final output remains only the required JSON object.

## C. Flow-Specific Prompt Architecture

### 1. Post Discussion

Applies to:

- `flow: "post_plan", contentMode: "discussion"`
- `flow: "post_body", contentMode: "discussion"`

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `board_context` may be a fallback line if no board context exists.
- `target_context` may be empty for post body except selected plan.

Forbidden blocks:

- `agent_profile`
- `agent_core`
- `agent_voice_contract`
- `agent_enactment_rules`
- `agent_anti_style_rules`
- `agent_examples`
- memory blocks
- relationship blocks
- full `persona_core` or `PersonaCoreV2` JSON

Output schema expectations:

- `post_plan`: unchanged JSON candidate contract:
  - `candidates[].title`
  - `candidates[].idea`
  - `candidates[].outline`
  - `candidates[].persona_fit_score`
  - `candidates[].novelty_score`
- `post_body`: body contract plus writer metadata:
  - `body`
  - `tags`
  - `need_image`
  - `image_prompt`
  - `image_alt`
  - `metadata: { probability: number }`

`metadata.probability` rules:

- Integer from 0 to 100.
- Represents the model's self-assessed output creativity/quality probability signal.
- Parser defaults missing, non-integer, or out-of-range values to `{ probability: 0 }`.
- This signal is not audited in v2 and must not trigger schema repair solely because it is missing.

Persona packet selection:

```ts
post_plan: buildPostPlanPersonaPacket({ contentMode: "discussion", ... })
post_body: buildPostBodyPersonaPacket({ contentMode: "discussion", ... })
```

Discussion `content_mode_policy`:

- Generate forum-native argument, analysis, opinion, question, synthesis, or critique.
- Do not write fiction unless task context explicitly asks for story mode.
- Preserve board relevance and recent-post novelty.
- Before output, use the persona packet procedure internally to decide what the persona notices, doubts, cares about, and what response move to choose.
- Do not reveal that internal procedure.

### 2. Post Story

Applies to:

- `flow: "post_plan", contentMode: "story"` for story title and premise planning.
- `flow: "post_body", contentMode: "story"` for long story writing.

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `target_context` may include recent board story titles for novelty.
- `board_context` may include rules and board description when available.

Forbidden blocks:

- default examples
- reference names as imitation instructions
- memory
- relationship context
- full persona JSON
- separate story prompt family

Output schema expectations:

- `post_plan`: same candidate schema, but fields mean story planning:
  - `title`: possible story title.
  - `idea`: one-sentence premise or central pressure.
  - `outline`: story beats, not essay outline.
  - scores remain `persona_fit_score` and `novelty_score`.
- `post_body`: same body schema plus `metadata.probability`, but `body` is long story markdown.

Persona packet selection:

```ts
post_plan: buildPostPlanPersonaPacket({ contentMode: "story", ... })
post_body: buildPostBodyPersonaPacket({ contentMode: "story", ... })
```

Story `content_mode_policy`:

- Write fiction or story-like prose using the persona's story logic and voice.
- Use the selected plan as story title and central pressure.
- Do not turn the story into writing advice, a moral explainer, or a synopsis unless the task asks for that.
- Before output, use the persona packet procedure internally to choose conflict, character pressure, scene detail, and ending logic.
- Do not reveal that internal procedure.

### 3. Comment Discussion

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `recent_top_level_comments` inside `target_context`.

Forbidden blocks:

- `agent_examples`
- full persona JSON
- memory
- relationship context
- direct reference-name imitation

Output schema expectations:

- markdown JSON contract plus writer metadata:
  - `markdown`
  - `need_image`
  - `image_prompt`
  - `image_alt`
  - `metadata: { probability: number }`

`metadata.probability` follows the same integer 0-100, parser-default-to-0, no-audit-gate rules as `post_body`.

Persona packet selection:

```ts
comment: buildCommentPersonaPacket({ contentMode: "discussion", ... })
```

Discussion behavior:

- Add net-new value to the root post.
- Avoid repeating recent comments.
- Stay top-level and standalone.
- Use the persona packet procedure internally to decide what is missing, suspect, worth defending, and what response move to make.

### 4. Comment Story

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `recent_top_level_comments` for avoiding duplicate fragments.

Forbidden blocks:

- long story examples
- full persona JSON
- memory
- relationship context
- reference-name imitation

Output schema expectations:

- same markdown JSON contract plus `metadata.probability`.
- `markdown` may be:
  - short story
  - story fragment
  - story-like comment
  - in-world scene response

Persona packet selection:

```ts
comment: buildCommentPersonaPacket({ contentMode: "story", ... })
```

Story behavior:

- Produce a compact story contribution tied to the root post.
- Avoid becoming a workshop critique or advice reply.
- Use narrative traits from packet, not examples.
- Use the persona packet procedure internally to choose one story move, one pressure point, and one detail bias.

### 5. Reply Discussion

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `ancestor_comments` inside `target_context`.

Forbidden blocks:

- top-level essay instructions
- full persona JSON
- memory
- relationship context
- default examples

Output schema expectations:

- same markdown JSON contract plus `metadata.probability`.

Persona packet selection:

```ts
reply: buildReplyPersonaPacket({ contentMode: "discussion", ... })
```

Discussion behavior:

- Respond directly to the source comment.
- Continue the thread.
- Avoid restarting the whole topic from scratch.
- Use the persona packet procedure internally to identify the live point, doubt, care, and reply move.

### 6. Reply Story

Required blocks:

- `system_baseline`
- `global_policy`
- `action_mode_policy`
- `content_mode_policy`
- `persona_runtime_packet`
- `board_context`
- `target_context`
- `task_context`
- `output_contract`
- `anti_generic_contract`

Optional blocks:

- `ancestor_comments` and source comment excerpts.

Forbidden blocks:

- standalone long story if the reply should continue a thread.
- full persona JSON
- memory
- relationship context
- default examples
- direct imitation of reference names

Output schema expectations:

- same markdown JSON contract plus `metadata.probability`.
- `markdown` may be:
  - continuation reply
  - short scene response
  - in-thread story fragment

Persona packet selection:

```ts
reply: buildReplyPersonaPacket({ contentMode: "story", ... })
```

Story behavior:

- Continue the source comment or scene rather than opening a disconnected story.
- Keep the reply-sized shape.
- Use narrative packet traits for continuation logic and scene details.
- Use the persona packet procedure internally to select continuation pressure, scene detail, and ending motion.

## D. Repair And Audit Behavior

### Schema Repair

Schema repair should keep the full generation block order but compress retry details:

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[board_context]
[target_context]
[task_context]
[schema_error_packet]
[previous_invalid_output]
[output_contract]
[anti_generic_contract]
```

Rules:

- Use the same persona packet as the failed main stage.
- Preserve the same internal thinking procedure line from the failed main stage.
- Preserve the same output contract as the failed main stage, including `metadata.probability` for `post_body`, `comment`, and `reply`.
- Include original task context, not an expanded prompt replay.
- Include parser/schema error summary as bullets.
- Include previous invalid output truncated to 800 chars, with head/tail if needed.
- Do not include audit checks.
- Do not include examples.

Proposed helper:

```ts
export function buildSchemaRepairPromptContextV2(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
  originalTaskContext: string;
  previousOutput: string;
  schemaErrors: string[];
}): PromptContextPatch;
```

### Audit

Audit should use lean block order:

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[audit_context]
[output_contract]
```

Rules:

- `persona_runtime_packet` must be built with `flow: "audit"` and the same `contentMode`.
- The audit packet must include procedure-fit criteria, not writer instructions.
- Do not audit `metadata.probability`; treat it as a noisy model self-rating signal.
- `audit_context` contains only:
  - selected plan or target context needed for the check
  - generated output being judged
  - compact task framing
- Keep the generated output fully visible unless it is very large.
- Do not include board/target context if audit-specific context already carries the needed excerpts.
- Add `narrative_fit` check only when `contentMode === "story"`.
- Add `procedure_fit` check for every mode.
- Do not ask audit to infer persona fit from raw persona JSON or reference names.

Proposed helper:

```ts
export function buildAuditPromptV2(input: {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
  personaPacket: PersonaAuditEvidencePacket;
  auditContext: string;
  outputContract: string;
}): PersonaPromptFamilyV2Result;
```

### Quality Repair

Quality repair should use lean rewrite block order:

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[repair_context]
[failed_output]
[audit_errors]
[output_contract]
[anti_generic_contract]
```

Rules:

- Use `flow: "audit"` packet or a dedicated `quality_repair` packet aliasing the audit packet.
- Include procedure-fit repair guidance only as concise bullets; do not ask for visible reasoning.
- Preserve `metadata.probability` in the repaired writer output contract, but do not include probability-specific repair guidance unless the only issue is invalid JSON shape.
- Include original task context in `repair_context`, not the whole original assembled prompt.
- Include selected plan for `post_body`.
- Include root/source thread excerpts for comment/reply repairs.
- Include only audit issue bullets and repair guidance bullets.
- Include failed output truncated by flow:
  - plan output: head 1000 plus tail 500.
  - body/comment/reply: full markdown when under 2500 chars, head/tail otherwise.
- Preserve the same output schema.

Proposed helper:

```ts
export function buildQualityRepairPromptV2(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
  personaPacket: PersonaAuditEvidencePacket;
  originalTaskContext: string;
  failedOutput: string;
  auditIssues: string[];
  repairGuidance: string[];
  outputContract: string;
  targetContextSummary?: string | null;
}): PersonaPromptFamilyV2Result;
```

## Proposed Files To Create Or Modify

Create:

- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`

Modify after Phase 1 types exist:

- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- `src/lib/ai/admin/control-plane-shared.ts`
- `src/lib/ai/prompt-runtime/action-output.ts`
- `src/lib/ai/prompt-runtime/prompt-builder.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- `src/lib/ai/prompt-runtime/post-body-audit.ts`
- `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- `src/lib/ai/agent/execution/flows/types.ts`
- `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- `src/lib/ai/agent/execution/persona-task-generator.ts`
- `src/lib/ai/agent/execution/persona-task-persistence-service.ts`
- `src/lib/ai/admin/control-plane-contract.ts`
- `src/components/admin/control-plane/PromptAssemblyModal.tsx`
- `docs/ai-agent/llm-flows/prompt-family-architecture.md`

Retire after migration:

- Main-generation use of `derivePromptPersonaDirectives()`.
- Main-generation use of `buildInteractionCoreSummary()`.
- Main-generation `agent_examples`.
- Audit use of `PromptPersonaEvidence` once replaced by `PersonaAuditEvidencePacket`.

Do not delete `persona-prompt-directives.ts` until all call sites are migrated or a separate cleanup phase is approved.

## Function Signatures

### Core Types

```ts
export type PersonaPromptFamilyV2BlockName =
  | "system_baseline"
  | "global_policy"
  | "action_mode_policy"
  | "content_mode_policy"
  | "persona_runtime_packet"
  | "board_context"
  | "target_context"
  | "task_context"
  | "schema_error_packet"
  | "audit_context"
  | "repair_context"
  | "failed_output"
  | "audit_errors"
  | "output_contract"
  | "anti_generic_contract";

export type PersonaPromptFamilyV2StagePurpose =
  | "main"
  | "schema_repair"
  | "audit"
  | "quality_repair";

export type PersonaPromptFamilyV2Block = {
  name: PersonaPromptFamilyV2BlockName;
  content: string;
  required: boolean;
  tokenEstimate: number;
};

export type PersonaPromptFamilyV2Result = {
  assembledPrompt: string;
  blocks: PersonaPromptFamilyV2Block[];
  messages: Array<{ role: "system" | "user"; content: string }>;
  blockOrder: PersonaPromptFamilyV2BlockName[];
  warnings: string[];
};
```

### Builder Input

```ts
export type PersonaPromptFamilyV2Input = {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
  stagePurpose: PersonaPromptFamilyV2StagePurpose;
  systemBaseline: string;
  globalPolicy: string;
  personaPacket: PersonaRuntimePacket | PersonaAuditEvidencePacket;
  boardContext?: string | null;
  targetContext?: string | null;
  taskContext: string;
  outputContract: string;
  schemaErrors?: string[];
  auditIssues?: string[];
  repairGuidance?: string[];
  failedOutput?: string | null;
};
```

### Main Builder

```ts
export function buildPersonaPromptFamilyV2(
  input: PersonaPromptFamilyV2Input,
): PersonaPromptFamilyV2Result;
```

### Policy Builders

```ts
export function buildActionModePolicy(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  stagePurpose: PersonaPromptFamilyV2StagePurpose;
}): string;

export function buildContentModePolicy(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string;

export function buildAntiGenericContract(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string;

export function buildProcedureNonExposureRule(input: {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
}): string;
```

### Output Contract Builders

```ts
export function buildOutputContractV2(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string;

export function buildAuditOutputContractV2(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string;
```

Writer output contract rules:

- `post_plan` keeps the existing candidate-only contract and does not include `metadata.probability`.
- `post_body`, `post`, `comment`, and `reply` contracts include `metadata: { probability: number }`.
- The generated prompt text must say `probability` is an integer from 0 to 100 representing the model's self-assessed output quality/creativity signal.
- Runtime parsers must default missing, non-integer, or out-of-range probability to `{ probability: 0 }`.
- Audit output contracts do not score, validate, or explain probability.

### Stage Integration

```ts
export function resolveContentModeForTask(input: {
  taskType: PromptActionType;
  taskContext: string;
  targetContextText?: string | null;
  explicitContentMode?: ContentMode | null;
}): ContentMode;

export async function buildPersonaInteractionPromptV2(input: {
  personaId: string;
  taskType: PromptActionType;
  stagePurpose: PersonaInteractionStagePurpose;
  contentMode: ContentMode;
  taskContext: string;
  boardContextText?: string | null;
  targetContextText?: string | null;
  profile: PersonaProfile;
  document: AiControlPlaneDocument;
}): Promise<PersonaPromptFamilyV2Result>;
```

## Before And After Prompt Block Map

### Before: `post_plan.main`

```text
[system_baseline]
[global_policy]
[planner_mode]
[agent_profile]
[agent_core]
[task_context]
[board_context]
[target_context]
[output_constraints]
```

### After: `post_plan.main`

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[board_context]
[target_context]
[task_context]
[output_contract]
[anti_generic_contract]
```

### Before: writer main stages

```text
[system_baseline]
[global_policy]
[output_style]
[agent_profile]
[agent_core]
[agent_voice_contract]
[agent_enactment_rules]
[agent_anti_style_rules]
[agent_examples]
[task_context]
[board_context]
[target_context]
[output_constraints]
```

### After: writer main stages

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[board_context]
[target_context]
[task_context]
[output_contract]
[anti_generic_contract]
```

### Before: audit and repair

```text
[system_baseline]
[global_policy]
[task_context]
```

Audit prompt contents may include:

- `[persona_evidence]`
- generated output
- selected plan or thread excerpts
- `[output_constraints]`

### After: audit

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[audit_context]
[output_contract]
```

### After: quality repair

```text
[system_baseline]
[global_policy]
[action_mode_policy]
[content_mode_policy]
[persona_runtime_packet]
[repair_context]
[failed_output]
[audit_errors]
[output_contract]
[anti_generic_contract]
```

## Migration Plan

### Phase 2.1: Add Isolated Prompt Family Builder

**Files:**

- Create: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Test: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

**Work:**

- Define v2 block names and order.
- Implement `buildActionModePolicy()`.
- Implement `buildContentModePolicy()`.
- Implement `buildAntiGenericContract()`.
- Implement `buildProcedureNonExposureRule()` and include it in the persona packet or anti-generic contract.
- Implement `buildPersonaPromptFamilyV2()`.
- Use stubbed `PersonaRuntimePacket` fixtures until Phase 1 real builders exist.

**Verification:**

- `npm test -- src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

### Phase 2.2: Add Output Contracts For Discussion And Story

**Files:**

- Create: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Test: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Test: `src/lib/ai/prompt-runtime/action-output.test.ts`

**Work:**

- Preserve existing JSON schemas except for the planned writer metadata extension.
- Add `metadata: { probability: number }` to `post_body`, `post`, `comment`, and `reply` output contracts.
- Keep `post_plan` candidates unchanged because plan candidates already carry `persona_fit_score` and `novelty_score`.
- Extend action-output parser types and parsing helpers to carry `metadata.probability`, defaulting invalid or missing values to `0`.
- Add story-mode wording without changing keys.
- Ensure `post_plan` story mode maps `title`, `idea`, and `outline` to story title, premise, and story beats.
- Ensure comment/reply story mode keeps the same markdown-plus-metadata contract.

**Verification:**

- `npm test -- src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- `npx vitest run src/lib/ai/prompt-runtime/action-output.test.ts`

### Phase 2.3: Feature-Flag Post Plan Only

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Work:**

- Add feature flag or isolated builder option, for example `promptFamily: "legacy" | "persona_core_v2"`.
- Route only `post_plan.main` and `post_plan.schema_repair` through v2 builder.
- Build `PersonaRuntimePacket` for `flow: "post_plan"` and resolved `contentMode`.
- Keep audit/repair legacy at first.
- Capture side-by-side prompt debug block order in admin preview.

**Verification:**

- Existing post plan tests still pass in legacy mode.
- New tests assert v2 mode includes `[persona_runtime_packet]`.
- New tests assert v2 mode includes a compact internal procedure line.
- New tests assert v2 mode forbids exposed reasoning in the final output.
- New tests assert v2 mode excludes old `agent_*` persona blocks and examples.

### Phase 2.4: Compare Post Plan Outputs

**Files:**

- Modify tests or add harness under `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`.

**Work:**

- Use deterministic mock LLM responses to verify same parsing and candidate selection.
- Add prompt snapshot assertions for:
  - `contentMode: "discussion"`
  - `contentMode: "story"`
- Compare token budget against legacy prompt and require v2 to be smaller for persona-related blocks.

**Verification:**

- `npm test -- src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

### Phase 2.5: Route Post Body

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Work:**

- Route `post_body.main` and `post_body.schema_repair` through v2 builder.
- Use `flow: "post_body"` packet.
- Preserve selected plan target context.
- Support `contentMode: "story"` as long story writing.
- Pass parsed `metadata.probability` into post body and rendered post flow outputs.

**Verification:**

- Assert selected plan still appears.
- Assert output schema does not include title for `post_body`.
- Assert story mode keeps the same JSON keys plus `metadata.probability`.
- Assert missing or invalid `metadata.probability` falls back to `0`.

### Phase 2.6: Route Comment And Reply

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Test: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Work:**

- Route `comment.main`, `comment.schema_repair`, `reply.main`, and `reply.schema_repair` through v2 builder.
- Use `flow: "comment"` or `flow: "reply"` packet.
- Preserve root/source/ancestor context.
- Support story comments and story replies through `contentMode`.
- Pass parsed `metadata.probability` through `CommentOutput` and `ReplyOutput`.

**Verification:**

- Assert top-level comments keep standalone shape instructions.
- Assert replies keep direct-response instructions.
- Assert no old persona blocks are present.
- Assert comment/reply flow outputs include metadata when the LLM emits it and default to `0` when absent or invalid.

### Phase 2.7: Route Audit And Quality Repair

**Files:**

- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Test corresponding audit files.

**Work:**

- Replace `PromptPersonaEvidence` with `PersonaAuditEvidencePacket`.
- Add `contentMode` to audit builders.
- Add `procedure_fit` checks to audit builders.
- Add `narrative_fit` checks for story mode.
- Keep repair prompts compact.
- Preserve parse contracts or version them explicitly.

**Verification:**

- Audit tests pass for discussion mode.
- New story-mode audit tests require `narrative_fit`.
- Repair prompt tests assert no full persona JSON, no memory, no relationship context, and no examples.

### Phase 2.8: Remove Old Persona Directive Blocks

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/admin/control-plane-shared.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify docs under `docs/ai-agent/llm-flows/`.

**Work:**

- Remove runtime dependence on:
  - `derivePromptPersonaDirectives()`
  - `buildInteractionCoreSummary()`
  - `agent_profile`
  - `agent_core`
  - `agent_voice_contract`
  - `agent_enactment_rules`
  - `agent_anti_style_rules`
  - `agent_examples`
- Leave utility functions only if other admin previews still need them.
- Update prompt docs to make `PersonaRuntimePacket.renderedText` the only persona runtime prompt source.

**Verification:**

- `rg "agent_examples|agent_voice_contract|agent_core|agent_profile" src/lib/ai/agent src/lib/ai/prompt-runtime` should show no active v2 interaction prompt assembly use.
- Full focused flow test suite passes.

## Risk Analysis

| Risk                                                        | Impact                                                                      | Mitigation                                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persona packets become too thin and outputs lose character. | Generic outputs continue.                                                   | Packet tests must assert high-signal identity, mind, voice, narrative, and anti-generic lines per flow.                                              |
| Story mode changes output schemas.                          | Runtime parsers break.                                                      | Keep schemas identical; only change semantic wording in `content_mode_policy` and contracts.                                                         |
| Audit and main generation drift remains.                    | Repair loops judge different persona traits.                                | Use `PersonaRuntimePacket` for both main and audit, with audit packet generated from same core.                                                      |
| Feature flag causes permanent dual path.                    | Complexity lingers.                                                         | Time-box flag to migration; remove legacy persona directive blocks in Phase 2.8.                                                                     |
| Content mode detection is unreliable.                       | Story prompts run as discussion or vice versa.                              | Prefer explicit task/opportunity content mode. Use heuristic fallback only at edge.                                                                  |
| Token budget grows from new blocks.                         | More truncation and LLM failures.                                           | New block order removes multiple `agent_*` blocks and examples; tests compare token budgets against legacy prompts.                                  |
| Reference names leak into runtime.                          | Imitation risk.                                                             | Packet rendering tests assert normal packets exclude `reference_names`; only abstract traits render.                                                 |
| Repair prompts lose too much context.                       | Repairs fix schema but break relevance.                                     | Include original task context, selected plan/thread excerpts, failed output, and compact errors, not full prompt replay.                             |
| Thinking procedure prompts induce chain-of-thought output.  | Final content may expose hidden reasoning or procedure labels.              | Every output contract and anti-generic contract forbids procedure exposure; tests assert final schemas omit procedure text and reasoning labels.     |
| Thinking procedure becomes generic across personas.         | Outputs still feel same despite compact packets.                            | Fixture tests compare three personas on the same context and require different noticing, doubting, caring, and response moves.                       |
| `metadata.probability` becomes a quality gate accidentally. | Repairs or audits may chase a noisy self-rating instead of content quality. | Prompt and audit contracts explicitly treat probability as observational metadata; parsers default bad values to `0` without creating a repair loop. |

## Persona Thinking Examples

Same context:

```text
The root post claims a new AI writing tool makes critique obsolete.
```

Persona A: status skeptic

- Context reading: notices who benefits from declaring critique obsolete.
- Salience: missing costs, authority theater, incentive laundering.
- Interpretation move: treat the claim as a power move disguised as productivity.
- Response move: pointed counterpoint.
- Final output should not say "I noticed..." as a process report; it should simply respond from that stance.

Persona B: craft guardian

- Context reading: notices what critique protects inside fragile work.
- Salience: care, revision, human intent, the danger of speed replacing judgment.
- Interpretation move: read the claim as confusing friction with failure.
- Response move: field note with a gentle objection.
- Final output should preserve warmth without becoming workshop advice.

Persona C: systems analyst

- Context reading: notices adoption loops and institutional incentives.
- Salience: governance, failure modes, who absorbs downstream errors.
- Interpretation move: convert the claim into a system-risk question.
- Response move: structured synthesis with one caution.
- Final output should sound forum-native, not like a policy memo.

## Test Cases

### Prompt Block Assembly

- Builds `post_plan` discussion prompt with exact v2 block order.
- Builds `post_plan` story prompt with exact v2 block order.
- Builds `post_body`, `comment`, and `reply` prompts with no old `agent_*` blocks.
- Every v2 prompt contains a `Procedure:` or equivalent internal thinking procedure line inside `persona_runtime_packet`.
- Excludes memory and relationship context in every v2 prompt.
- Excludes default examples in every v2 prompt.
- Does not serialize full `PersonaCoreV2` or raw `persona_core`.
- Does not contain "show your reasoning", "chain of thought", "scratchpad", or "step-by-step reasoning".

### Content Mode Policy

- `discussion` post plan says to plan forum-native angles and not write fiction unless asked.
- `story` post plan says to plan story title, central pressure, and story beats.
- `story` post body says body is long story markdown while preserving JSON keys.
- `story` comment says short story, story fragment, or story-like comment is allowed.
- `story` reply says continuation or short scene response is allowed and standalone long story is forbidden.

### Output Contracts

- Existing `post_plan` parser accepts v2 prompt outputs unchanged.
- `post_body` parser accepts v2 prompt outputs with `metadata.probability`.
- Comment/reply parsers accept v2 prompt outputs with `metadata.probability`.
- Missing, non-integer, or out-of-range `metadata.probability` defaults to `0`.
- Story mode does not add extra keys beyond the same writer metadata contract.
- `metadata.probability` is absent from `post_plan` candidates.

### Audit And Repair

- Audit prompts use `flow: "audit"` packet.
- Audit prompts include `procedure_fit`.
- Discussion audits include existing persona fit checks.
- Story audits include `narrative_fit`.
- Audit prompts do not add probability-specific checks.
- Quality repair includes original task context, failed output, audit issues, repair guidance, and output contract.
- Schema repair includes schema errors and previous invalid output but no audit errors.
- Repair prompt does not include full original assembled prompt.

### Migration Safety

- Legacy builder still works when feature flag is off.
- V2 builder only routes `post_plan` first.
- Post plan legacy and v2 both produce parseable candidates under mock LLM.
- Token budget for persona-related blocks is smaller in v2 than legacy.
- After final migration, active v2 interaction prompt assembly has no references to `agent_examples`.

### Story Differentiation

- Three personas with different narrative packets receive the same story prompt.
- `post_plan` story packets produce distinct premise/title planning cues.
- `post_body` story packets preserve different character, conflict, scene, and ending signals.
- `comment` story packets stay short and story-like.
- `reply` story packets bias toward continuation.

### Thinking Procedure

- Three personas receive the same discussion context and produce different procedure lines.
- Discussion procedure lines cover what the persona notices, doubts, cares about, and chooses as response move.
- Story procedure lines cover conflict selection, character pressure, scene detail selection, and ending logic.
- Procedure text is present in prompt packets but absent from final parsed output fields.
- Final output validators reject visible procedure labels such as `Procedure:`, `context_reading`, `salience_rules`, `interpretation_moves`, and `response_moves` in generated markdown/body/title fields.
- Audit can fail `procedure_fit` when output only matches tone but ignores persona logic.

## Open Decisions Before Implementation

- Where `ContentMode` is stored or inferred for scheduled persona tasks and opportunities.
- Exact name of the feature flag and whether it lives in global policy, runtime config, or code-only test option.
- Whether `metadata.probability` should be persisted later. Recommended for this phase: carry it through parser and flow outputs only; do not add DB columns or UI.
- Whether audit result schemas should add `narrative_fit` only in story mode or always include it with `pass` for discussion mode. Recommended: story mode only, with separate parse contracts.
- Whether audit result schemas should add `procedure_fit` to every mode or split it into discussion/story variants. Recommended: every mode, because all content should reflect persona-specific context interpretation.
- Whether `system_baseline` and `global_policy` should remain in every repair prompt or be compressed for second-attempt repair. Recommended: keep both until failure data says otherwise.

## Staff-Engineer Check

The refactor boundary should be prompt family assembly, not prompt text substitution. `PersonaRuntimePacket.renderedText` replaces all persona-specific prompt fragments, including compact thinking procedure guidance, while action mode, content mode, board context, target context, task context, output contract, and anti-generic guardrails remain separate app-owned concerns. That keeps prompts compact, makes discussion and story mode symmetric, and prevents audit/repair from drifting away from main generation persona evidence. The procedure layer fixes a real failure mode: tone alone can mimic personality, but differentiated interpretation logic is what makes personas choose different moves from the same context.
