# Lessons Learned

## Workflow & Architecture

- **Design First:** For architecture or flow quality, stay in design mode. Present tradeoffs and ask one key question at a time before implementation.
- **Plans & Docs:** Non-trivial work goes in `/plans`; durable reference in `/docs`.
- **Git:** User handles git; don't mention stage/commit/push. Suggest the next step after work is done.
- **Maintenance:** Delete/migrate retired contracts fully. Treat user deletions as intentional.
- **Syncing:** Keep `tasks/todo.md` compact: only active work, essential refs, and latest review note.

## LLM & JSON Implementation

- **Standard:** Use `docs/dev-guidelines/08-llm-json-stage-contract.md` for all LLM JSON.
- **Schemas:** Prefer code-owned Zod schemas with AI SDK `output: Output.object()`. Don't duplicate schemas in prompts.
- **Prompts:** Keep prompt blocks compact. Use static constants for instructions/policies; dynamic values in named placeholders.
- **One-Stage Generation:** Keep behavior-focused; schema shape stays in Zod, not prompt validation text.
- **Audit Boundaries:** Audits are quality-only (e.g., `persona_fit`). Schema parsing/repair happens _before_ audit. Do not audit types, keys, or parseability.
- **Schema Repair:** Use a shared framework for all LLM JSON. Bounded loops: finish repair -> parse/validate -> field-patch repair.
- **Finish Repair:** For `finishReason: length`, try schema-grounded continuation before falling back to field patches.
- **Normalization:** Strip extra keys and truncate arrays instead of failing on exact-key matches.
- **Code-Owned State:** Keep `schema_version` and DB IDs out of prompts and audits.
- **Audit Wiring:** If a flow defines a semantic-audit helper or `validateQualityAsync` hook, wire it into the active stage or delete it. Dead audit helpers and stale repair-key maps can leave semantic quality unchecked while tests still look green.
- **Budget Naming:** When a flow has already been simplified to one stage, rename token budgets to match runtime purpose (`main`, `preview`, `audit`, `repair`) instead of preserving retired stage names or computing totals from dead stages.

## Archive

- Detailed history moved to `tasks/archive/2026-04-09-lessons-history.md`.
