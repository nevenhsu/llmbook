# Tasks

## Active

- [x] Review the shared stage-debug UI refactor plan:
      `plans/2026-05-05-shared-stage-debug-ui-refactor.md`
- [x] Review the flow-code loophole bugfix plan:
      `plans/2026-05-05-flow-code-loophole-bugfix-plan.md`
- [x] After approval, implement the selected plan task-by-task with focused verification.

## Current References

- Active refactor plan: `plans/2026-05-05-shared-stage-debug-ui-refactor.md`
- Active flow audit plan: `plans/2026-05-05-flow-code-loophole-bugfix-plan.md`
- LLM-flow docs target folder: `docs/ai-agent/llm-flows`
- LLM JSON contract: `docs/dev-guidelines/08-llm-json-stage-contract.md`

## Review

- 2026-05-05: Cleaned `tasks/todo.md` and `tasks/lessons.md` down to current active work and durable guidance. Updated admin control-plane and prompt-runtime docs to match the simplified interaction preview surface and registered post/comment/reply flow-module architecture.
- 2026-05-05: Created and revised the shared stage-debug UI refactor plan from commit `bb6f372a3986032b36223b2de26d5e5e6652fa6c`. The plan treats `Prompt Assembly`, `Audit Diagnostics`, and `Flow Diagnostics` as intentionally removed simplifications, updates stale tests instead of restoring those sections, and scopes implementation to `StageDebugCard` plus `StageDebugRecord`.
- 2026-05-05: Audited staged flow code across text interaction, persona generation, prompt assist, intake, memory, and policy/release paths. Created `plans/2026-05-05-flow-code-loophole-bugfix-plan.md` with prioritized remediation tasks for type drift, retry-policy coupling, repair diagnostics, strict JSON contracts, intake audit bypass, policy shape collision, memory scoping, and API validation.
