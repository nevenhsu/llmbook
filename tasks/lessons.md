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
- **Shared Repair:** Use a shared framework for all LLM JSON. Keep repair bounded to deterministic syntax salvage before parse success, then `field_patch` for parseable schema-invalid data.
- **User Corrections:** Apply the latest correction literally, even if it reverses an earlier correction in the same thread; when the user says they only want `field_patch`, retire `schema_repair` again and update the plan/docs to match.
- **Plan Revisions:** When the user updates an existing plan, merge the new contract into the current handoff structure instead of replacing the earlier plan wholesale unless they explicitly ask for a rewrite.
- **Prompt Builder Placement:** When the user frames a prompt refactor as shared runtime infrastructure, do not default the builder to an admin-local module just because the current UI is the first visible consumer. Treat runtime/admin parity and future builder reuse as the placement signal, and prefer `src/lib/ai/prompt-runtime/...` ownership.
- **Prompt Builder Scope:** When the user scopes a new canonical prompt-text extraction to one pipeline, do not broaden it into shared-type cleanup or edits to an already-completed sibling builder. Keep ownership alignment separate from cross-builder abstraction unless the user explicitly asks for that refactor.
- **Prompt-Assist Terminology:** Do not promote `PromptAssistAttemptStage` into a repo-level stage concept. For prompt-assist, treat those strings as admin API attempt labels / diagnostics, while the real architectural concept stays "admin helper pipeline".
- **Prompt-Assist Simplification:** If the user simplifies PromptAssist to a single `invokeStructuredLLM` call while preserving `{ text, referenceNames }`, stop designing around the old resolution/audit/rewrite multi-call path. Treat that as a product-contract change first, and only then refactor prompt ownership within the new one-call shape.
- **Prompt-Assist Contract Drift:** When the user replaces PromptAssist's text-plus-suffix contract with a structured payload like `{ text, referenceNames, debugRecords }`, do not preserve suffix cleanup helpers or old multi-call assumptions. Update the plan around the new response contract, require debug records on both success and failure, and treat empty `referenceNames` as a hard error in the new shape.
- **Naming Boundaries:** Do not rename one helper concept toward another existing helper concept just to get a nicer filename. In this repo, `prompt-assist` and `context-assist` are already separate product concepts and filenames should preserve that boundary.
- **Prompt Placeholder Rules:** When the user defines exact empty-placeholder fallback text for prompt templates, preserve the placeholder block and replace the placeholder literally; do not delete the section or invent alternate fallback wording.
- **Prompt Test Strictness:** If the user expects to hand-tune prompt wording, do not lock tests to exact prompt strings or exact mock call payloads beyond stable contract boundaries. Prefer boundary-level assertions like stage order, block presence, structured handoff shape, and a few semantic markers.
- **No Stage Wrapper Drift:** If the user removes a wrapper prompt block like `persona_generation_stage`, delete it from the canonical builder and its preview/tests completely instead of leaving a vestigial stage label around the one-stage prompt.
- **Stage Artifact Naming:** When a stage artifact stops being a richer version of a prior object and becomes its own stage product, rename it to match the stage boundary directly; for `post_frame`, prefer `PostFrameSchema` / `PostFrame` over stale `PostPlanV2` naming.
- **Code-Owned Context:** Request-owned invariants like content mode and locked title should be passed by app code, not authored by the model and then revalidated from output.
- **Persona Generation Drift:** When active Persona v2 plans say generate-persona is one-stage `persona_core_v2`, current docs must not describe `seed -> persona_core` as the live contract; keep two-stage references only in clearly archived historical docs.
- **Superseded Plans:** When older non-archived implementation plans conflict with the active contract, add an explicit superseded/status banner instead of leaving them to read like current guidance.
- **Repair Boundaries:** Keep deterministic syntax salvage separate from `field_patch`. Syntax salvage may only close incomplete JSON structure; `field_patch` starts only after parseability.
- **Length Failures:** For `finishReason: length`, try deterministic syntax salvage only when there is a usable incomplete JSON prefix; otherwise fail closed or retry `main` at the flow boundary.
- **Normalization:** Strip extra keys and truncate arrays instead of failing on exact-key matches.
- **Code-Owned State:** Keep `schema_version` and DB IDs out of prompts and audits.
- **Audit Wiring:** If a flow defines a semantic-audit helper or `validateQualityAsync` hook, wire it into the active stage or delete it. Dead audit helpers and stale repair-key maps can leave semantic quality unchecked while tests still look green.
- **Budget Naming:** When a flow has already been simplified to one stage, rename token budgets to match runtime purpose (`main`, `preview`, `audit`, `repair`) instead of preserving retired stage names or computing totals from dead stages.

## Archive

- Detailed history moved to `tasks/archive/2026-04-09-lessons-history.md`.
