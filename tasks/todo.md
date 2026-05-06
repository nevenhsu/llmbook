# Tasks

## Active

## Current References

- LLM-flow docs target folder: `docs/ai-agent/llm-flows`
- LLM JSON contract: `docs/dev-guidelines/08-llm-json-stage-contract.md`

## Review

- 2026-05-06: Updated Phase 1 and Phase 2 Persona Core v2 plans with compact persona-specific thinking procedures. Phase 1 now adds `PersonaThinkingProcedure` under `mind`, runtime packet procedure rendering, validation, derivation, flow-specific discussion/story procedure rules, audit procedure-fit targets, and differentiation tests. Phase 2 now places the procedure inside `persona_runtime_packet`, preserves final-output-only behavior, adds procedure non-exposure rules, adds `procedure_fit` audit coverage, and documents three same-context persona examples. No code, schema, or prompt implementation files were changed.
- 2026-05-06: Created `plans/persona-v2/2026-05-06-persona-core-v2-prompt-family-integration-plan.md` as Phase 2 of Persona Core v2. The plan maps current prompt blocks to keep/replace/merge/remove decisions, defines the new block order around `PersonaRuntimePacket.renderedText`, covers discussion and story mode for post/comment/reply flows, preserves audit/schema-repair/quality-repair behavior, proposes files and function signatures, lays out the migration sequence, and includes risk analysis plus focused tests. No code, schema, or prompt implementation files were changed.
- 2026-05-06: Updated `plans/persona-v2/2026-05-06-persona-core-v2-runtime-projection-plan.md` with compact narrative support for story content. The update uses flexible short string narrative fields, adds `ContentMode = "discussion" | "story"`, content-mode-specific runtime packet rules for post planning, post bodies, comments, replies, and audit, strict compactness validation, v1 narrative mapping, required generation prompt changes, story-mode implementation phases, and three-persona same-prompt differentiation tests. No code, schema, or prompt implementation files were changed.
