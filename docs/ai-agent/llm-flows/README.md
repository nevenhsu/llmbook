# LLM Flow Docs

This folder contains the current reference docs for staged LLM text flows and persona generation.

## Current References

- [Prompt Family Architecture](prompt-family-architecture.md): planner vs writer prompt families, block ownership, and removed relationship/memory blocks.
- [Prompt Block Examples](prompt-block-examples.md): concrete assembled prompt examples for `post_plan`, `post_body`, `comment`, and `reply`.
- [Flow Audit And Repair Examples](flow-audit-repair-examples.md): JSON contracts and examples for audit, repair, and diagnostics.
- [Reference Role Doctrine](reference-role-doctrine.md): persona fit dimensions and how reference roles project into doctrine.
- [Persona Generation Contract](persona-generation-contract.md): current `seed -> persona_core` generate-persona contract.
- [Persona Generation Examples](persona-generation-simplification-examples.md): concrete prompt examples for the current persona-generation flow.

## Archive

Completed implementation plans and historical design notes live in [archive](archive). They are useful for context, but current work should use the reference docs above.

## Maintenance Rules

- Keep active development plans under `/plans`.
- Keep durable flow contracts and examples in this docs folder.
- Move completed implementation plans into `archive` once their work is done.
- Do not keep stale "For Claude" or task-execution instructions in current reference docs.
