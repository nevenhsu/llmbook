# Tasks

## Active

- [x] Execute the integrated LLM-flow program from `plans/ai-agent/llm-flows/llm-flows-integration-plan.md` so shared foundations, `post`, `comment` / `reply`, and generate-persona land in one coordinated sequence.
- [x] Introduce one shared text flow-module registry for `post`, `comment`, and `reply`, and route generator/preview/runtime/jobs through it so the app no longer owns parallel text-generation paths.
- [x] Implement the staged `post_plan -> post_body` module with hard novelty gating, locked selected title, and a merged body/persona audit contract.
- [x] Implement first-class `comment` and `reply` flow modules from `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`, including `notification -> reply` normalization and separate prompt/audit contracts.
- [x] Migrate generate-persona to the simplified `seed -> persona_core` contract, remove all relationship-coded output/runtime assumptions, and omit generated memories entirely.

## Current References

- LLM flow integration plan: `plans/ai-agent/llm-flows/llm-flows-integration-plan.md`
- Reference-role doctrine plan: `plans/ai-agent/llm-flows/reference-role-doctrine-plan.md`
- Post flow implementation plan: `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- Comment/reply flow implementation plan: `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- Prompt family architecture plan: `plans/ai-agent/llm-flows/prompt-family-architecture-plan.md`
- Persona-generation simplification plan: `plans/ai-agent/llm-flows/persona-generation-simplification-plan.md`
- Persona-generation simplification examples: `plans/ai-agent/llm-flows/persona-generation-simplification-examples.md`
- Prompt block reference: `plans/ai-agent/llm-flows/prompt-block-examples.md`
- Flow audit/repair reference: `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`

## Review

- Completed Task 5 cleanup and Task 6 verification from the main LLM-flow integration plan: active admin docs, prompt examples, mock fixtures, and API tests now describe the simplified `seed -> persona_core` persona-generation contract and no active memory/relationship prompt blocks.
- Removed `relationshipTendencies` and `defaultRelationshipStance` from runtime core profile/summary types and aligned reply-worker legacy code so it no longer attempts to inject memory or relationship blocks into the shared prompt builder.
- Tightened cleanup search expectations in the integration plan because the original grep scanned its own search strings plus durable memory-module table access; final classification now separates historical docs, memory table support, absence assertions, and active production prompt/runtime dependencies.
- Marked the legacy reply-worker README as non-current so new production text generation does not bypass the shared `post` / `comment` / `reply` flow registry.
- Verified the integrated flow stack with the Task 6 targeted test set: 21 test files passed, 89 tests passed.
- Ran targeted lint for `src/lib/ai/prompt-runtime`, `src/lib/ai/agent/execution`, `src/lib/ai/admin`, `src/lib/ai/core`, and `PersonaStructuredPreview.tsx`; it exits 0 with existing warnings only.
- Ran filtered TypeScript review for touched AI flow/admin/core/UI paths; no matched errors remain.
- Ran final legacy-contract searches: active production prompt/runtime code has no `agent_relationship_context`, `relationshipTendencies`, `defaultRelationshipStance`, or active `[agent_memory]` dependency; remaining full-search hits are historical docs, this plan's cleanup strings, durable memory-table code, or tests asserting absence.
- Migrated generate-persona preview/runtime to the simplified `seed -> persona_core` contract: `persona-generation-preview-service.ts` now runs exactly two stages, removes the active `memories` path, drops the named `[validated_context]` block, keeps carry-forward seed data inside the stage block, and assembles final structured output without `persona_memories`.
- Added the new persona-core parser/quality gate in `persona-generation-contract.ts`: `parsePersonaCoreStageOutput()` and `validatePersonaCoreStageQuality()` now own the second-stage schema plus compact doctrine-signal checks for downstream `value_fit` / `reasoning_fit` / `discourse_fit` / `expression_fit` derivation.
- Removed generated persona memories from admin save/update flows by shrinking `PersonaGenerationStructured`, simplifying `persona-save-payload.ts`, and dropping `now`-driven memory payload mapping from `useAiControlPlane`.
- Updated preview mocks, prompt-template preview, structured-preview UI, and related tests so admin surfaces now reflect the 2-stage generate-persona contract instead of the old `values/context/interaction/memories` stack.
- Verified the generate-persona migration with focused tests covering prompt template preview, payload building, stage parsing, store preview execution, mock preview UI, and update-preview save flow; also ran filtered TypeScript checks confirming the touched generate-persona/UI files no longer reference the old `persona_memories` contract.
- Extended the first-class `comment` / `reply` runtime path so their shared flow modules are no longer thin adapters: both now use a shared single-stage writer-flow helper that owns one fresh regenerate attempt, emits flow-level audit diagnostics, and keeps the registry envelope aligned across preview/runtime.
- Added dedicated flow-module tests for `comment` and `reply`, locking compact audit summaries (`comment_audit` / `reply_audit`), regenerate-on-terminal-failure behavior, and the shared writer media tail in the parsed result envelope.
- Verified the updated comment/reply stack with focused tests, targeted lint, and filtered TypeScript checks covering the new flow helper, audit contracts, interaction service, generator routing, and preview/runtime result types.
- Extended the staged `post` flow with a real merged `post_body_audit` + single repair loop inside `AiAgentPersonaInteractionService`: `post_body` now parses body-stage JSON, audits rendered final post quality/persona fit from a compact packet, repairs once with a fuller packet, and returns rendered final post markdown while keeping raw JSON for runtime parsing.
- Added `src/lib/ai/prompt-runtime/post-body-audit.ts` plus tests to lock the merged audit contract (`contentChecks` + `personaChecks`) and the repair prompt shape, including explicit doctrine checks for `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit`.
- Enriched staged post diagnostics so the shared result envelope now carries planning candidate summaries, hard-gate outcomes, and compact body-audit results, making preview/runtime consumers able to inspect which candidate was selected and whether body repair ran.
- Started Task 2 staged post flow implementation: added `post-plan-contract` deterministic parsing/gating utilities, switched the shared post registry entry from the legacy one-shot adapter to a real `post_plan -> post_body` module, and added a body-stage parser that rejects `title` while preserving the shared writer media tail.
- Verified the new staged post minimum path with focused tests covering canonical 3-candidate planning, hard-gate selection/regeneration, `selected_post_plan` handoff into `post_body`, prompt-builder compatibility, generator/registry routing, control-plane interaction preview, and executor/persistence compatibility.
- Remaining integrated-flow work now shifts past staged `post` into the dedicated `comment` / `reply` module redesign and the simplified generate-persona pipeline.
- Landed Task 1 shared flow foundations for the integrated LLM-flow program: added `flowKind` resolution in prompt-context building, introduced a shared text flow-module registry plus discriminated result envelope/diagnostics, and routed `AiAgentPersonaTaskGenerator` through flow modules instead of inline raw parsing.
- Split runtime prompt assembly into planner-family vs writer-family block orders, added `agent_posting_lens` / planner scaffolding, and removed active `agent_memory` / `agent_relationship_context` block emission from current prompt runtime.
- Updated prompt-runtime persona projection so relationship-derived wording is no longer required, added shared `buildPlannerPostingLens()` and `buildPersonaEvidence()` helpers, and aligned runtime summaries with the no-active-memory / no-active-relationship direction.
- Added `plans/ai-agent/llm-flows/reference-role-doctrine-plan.md` to formalize stronger persona fidelity: reference roles should project into doctrine across `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit`, and `writer_family` flows should self-check those dimensions before final output.
- Added `plans/ai-agent/llm-flows/llm-flows-integration-plan.md` as the main orchestration plan for current flow development, defining the implementation order, shared end-state, and verification gates across `post`, `comment`, `reply`, prompt-family runtime, and generate-persona work.
- Archived the previous full task log to `tasks/archive/2026-04-09-todo-history.md` to keep this file focused on current active work.
- Historical operator-console design/status docs are now explicitly labeled in-place so active flow work is easier to find.
- Added `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md` to formalize `comment` and `reply` as first-class flow modules, normalize `notification -> reply`, and lock the new prompt/audit boundaries before implementation.
- Added `plans/ai-agent/llm-flows/prompt-family-architecture-plan.md` to formalize the planner-family vs writer-family prompt split, define block ownership/data sources, and remove relationship generation / `agent_relationship_context` from the active prompt architecture.
- Added `plans/ai-agent/llm-flows/persona-generation-relationship-removal-plan.md` to formalize removal of relationship-coded generate-persona output and the downstream runtime/profile assumptions that still depend on it.
- Added `plans/ai-agent/llm-flows/persona-generation-simplification-plan.md` to capture the new recommended direction for persona generation: `2-stage` flow, no text prompt-family reuse, shared staged JSON runner, and no memory generation.
- Synced prompt/audit/persona-generation example references to the moved `/plans/ai-agent/llm-flows` paths.
- Marked `plans/ai-agent/llm-flows/persona-generation-prompt-examples.md` as historical so active implementation work follows the simplification plan/examples instead of the old 5-stage flow.
- Demoted `plans/ai-agent/llm-flows/persona-generation-relationship-removal-plan.md` to a historical cleanup note; the simplification plan is now the sole active generate-persona implementation direction.
