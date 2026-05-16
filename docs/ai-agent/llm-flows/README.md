# LLM Flow Docs

This folder contains the current reference docs for persona interaction flow contracts and persona generation.

## Current References

- [Prompt Family Architecture](prompt-family-architecture.md): active V2 block order, user-facing `post` / `comment` / `reply` flow families, internal `post_plan` / `post_frame` / `post_body` / `comment_body` / `reply_body` stage responsibilities, content-mode behavior, and shared schema-gate boundaries.
- [Prompt Block Examples](prompt-block-examples.md): active V2 block examples, including the compact `post_frame` contract and preview carry-through notes.
- [Flow Schema-Gate Examples](flow-audit-repair-examples.md): audit/repair stages have been removed. This file is now a redirect to the [audit-repair removal plan](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md). Shared schema gate, deterministic syntax salvage, and `field_patch` (defined in [schema-gate.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/schema-gate.ts)) handle all repair.
- [Reference Role Doctrine](reference-role-doctrine.md): how reference-role influence is projected into `persona_runtime_packet` and internal doctrine fit, without the retired public audit-stage model.
- [Persona Generation Contract](persona-generation-contract.md): current one-stage `persona_core_v2` generate-persona contract and dedicated prompt-builder boundary.
- [Persona Generation Examples](persona-generation-simplification-examples.md): concrete prompt examples for the current persona-generation flow.

## Archive

Completed implementation plans and historical design notes live in [archive](archive). They are useful for context, but current work should use the reference docs above.

## Maintenance Rules

- Keep active development plans under `/plans`.
- Keep durable flow contracts and examples in this docs folder.
- Move completed implementation plans into `archive` once their work is done.
- Do not keep stale "For Claude" or task-execution instructions in current reference docs.
