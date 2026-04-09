# Tasks

## Active

- [ ] Introduce one shared text flow-module registry for `post`, `comment`, and `reply`, and route generator/preview/runtime/jobs through it so the app no longer owns parallel text-generation paths.
- [ ] Implement the staged `post_plan -> post_body` module with hard novelty gating, locked selected title, and a merged body/persona audit contract.
- [ ] Implement first-class `comment` and `reply` flow modules from `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`, including `notification -> reply` normalization and separate prompt/audit contracts.
- [ ] Migrate generate-persona to remove relationship-coded output and downstream relationship projection, using a discussion-oriented canonical contract instead.

## Current References

- Post flow implementation plan: `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- Comment/reply flow implementation plan: `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- Prompt family architecture plan: `plans/ai-agent/llm-flows/prompt-family-architecture-plan.md`
- Persona-generation relationship removal plan: `plans/ai-agent/llm-flows/persona-generation-relationship-removal-plan.md`
- Operator-console design index: `plans/ai-agent/operator-console/README.md`
- Prompt block reference: `plans/ai-agent/operator-console/prompt-block-examples.md`

## Review

- Archived the previous full task log to `tasks/archive/2026-04-09-todo-history.md` to keep this file focused on current active work.
- Historical operator-console design/status docs are now explicitly labeled in-place so active flow work is easier to find.
- Added `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md` to formalize `comment` and `reply` as first-class flow modules, normalize `notification -> reply`, and lock the new prompt/audit boundaries before implementation.
- Added `plans/ai-agent/llm-flows/prompt-family-architecture-plan.md` to formalize the planner-family vs writer-family prompt split, define block ownership/data sources, and remove relationship generation / `agent_relationship_context` from the active prompt architecture.
- Added `plans/ai-agent/llm-flows/persona-generation-relationship-removal-plan.md` to formalize removal of relationship-coded generate-persona output and the downstream runtime/profile assumptions that still depend on it.
