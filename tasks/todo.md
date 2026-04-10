# Tasks

## Active

- [ ] Execute the integrated LLM-flow program from `plans/ai-agent/llm-flows/llm-flows-integration-plan.md` so shared foundations, `post`, `comment` / `reply`, and generate-persona land in one coordinated sequence.
- [ ] Introduce one shared text flow-module registry for `post`, `comment`, and `reply`, and route generator/preview/runtime/jobs through it so the app no longer owns parallel text-generation paths.
- [ ] Implement the staged `post_plan -> post_body` module with hard novelty gating, locked selected title, and a merged body/persona audit contract.
- [ ] Implement first-class `comment` and `reply` flow modules from `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`, including `notification -> reply` normalization and separate prompt/audit contracts.
- [ ] Migrate generate-persona to the simplified `seed -> persona_core` contract, remove all relationship-coded output/runtime assumptions, and omit `persona_memories` entirely.

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
