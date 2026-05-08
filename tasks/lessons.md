# Lessons Learned

## Current Rules

### Workflow

- Stay in design mode when the user asks for architecture or flow quality discussion first: assess the current shape, present tradeoffs, and ask only one key question at a time before proposing implementation.
- For non-trivial work, write active development plans under `/plans`; durable reference material belongs under `/docs`.
- Keep `tasks/todo.md` concise: active work, essential references, and the latest review note only.
- Treat user reorganizations or deletions as intentional unless told otherwise; sync references instead of restoring stale files.
- When the project says the user handles git independently, do not mention stage/commit/push handling unless asked.
- At the end of completed work, suggest the next practical step.

### UI And Test Drift

- When recent UI sections disappeared after an explicit simplification commit, treat stale failing assertions as test drift unless the user confirms a regression.
- Do not plan to restore removed UI from test failures alone; update tests to match the simplified contract.

### Active Development Contracts

- Migrate retired contracts fully instead of preserving compatibility branches, dual reads, or empty placeholder fields.
- Keep model-owned JSON semantic only; DB ids, persona ids, routing keys, and deterministic ranking stay app-owned.

### LLM JSON Work

- Before implementing runtime/admin LLM JSON used by persistence, ranking, cleanup, or automation, read `docs/dev-guidelines/08-llm-json-stage-contract.md`.
- For AI SDK structured outputs, prefer code-owned Zod schemas with `generateText({ output: Output.object({ schema }) })`; do not duplicate full key/type JSON schemas inside prompt output blocks.
- In Persona v2 prompt-family docs, `task_context`, `audit_context`, and short `output_format` policies are static prompt constants; dynamic values belong in named placeholders or separate dynamic context blocks, and structure belongs in code-owned schemas.
- Persona v2 main static prompt blocks should provide exact action/content/task wording for every flow/contentMode, with stage boundaries clear enough for the model but no dynamic persona, board, post, comment, or example text embedded.
- One-stage Persona Core v2 generation should keep prompt blocks compact and behavior-focused; schema shape stays in `PersonaCoreV2Schema`, while prompt validation text only reminds required semantic limits.
- Audit prompt examples must define check standards and reference code-owned audit schemas, not repeat the generation task or embed key/type audit JSON.
- Persona v2 prompt-family static constants should be explicit by flow and `contentMode`; audit and quality repair need discussion/story variants, not one generic conditional prompt.
- Persona v2 audits are quality-only because schema parsing and schema repair run before audit; do not add audit checks for required keys, field types, candidate count, parseability, or metadata shape.
- Persona v2 quality audits should inspect at most two aspects for budget control: one flow/content-quality aspect and `persona_fit`; fold board, novelty, markdown, thread, procedure, and story/narrative concerns into those aspects instead of adding more audit keys.
- Schema repair prompt examples should reference the shared JSON finish/field-patch repair framework instead of inventing standalone repair templates.
- Schema repair must be a shared framework for every LLM JSON output, not a Persona-only or prompt-family-specific repair path.
- JSON schema repair should be a bounded loop: finish repair returns to parse/schema validation, and parseable-but-schema-invalid finish output can continue into field-patch repair.
- Missing JSON fields are first-class schema repair targets when their paths are allowlisted; this includes Persona Core v2 generation output.
- Persona v2 generated-output schema checks should normalize rather than exact-key fail: strip extra keys, truncate overlong arrays to the first allowed items, and reserve invalidation for missing or malformed required fields.
- Writer output schemas for `post_body`, `comment`, and `reply` must mark generated content fields as markdown strings in code-owned Zod schemas.
- Spell nested leaf constraints explicitly in Zod schemas and schema-derived validation metadata; shorthand like `values{value_hierarchy,...}` is too ambiguous.
- Quality-repair prompts for large JSON objects must be compact on the first repair attempt.
- Repeated `finishReason: length` in quality repair is a repair-shape failure, not proof every stage budget is too low.
- For invalid JSON caused by `finishReason: length`, try schema-grounded finish-output repair with the full schema and previous output context before falling back to field patches.
- AI SDK structured-output errors where the provider fails to generate a parsable object conforming to the schema should route like `finishReason: length`: preserve any raw text prefix for finish continuation, or use the empty-length diagnostic path if no prefix exists.
- Reliable length repair needs a response-finishing framework: preserve the prefix, derive the open path and remaining schema fields, request append-only continuation, reject prefix rewrites, then validate before patch fallback.
- Repeated `finishReason: length` with empty visible output in semantic audits is an audit transport failure; use deterministic checks or pass open with diagnostics rather than only raising output tokens.
- If an audit or repair prompt judges persona fit, feed compact persona evidence from canonical persona fields.
- `metadata.probability` is AI self-rating metadata and must not be a quality-audit concern.
- For creative persona subprofiles that need expressive range, prefer strict compact string validation over closed enums unless the user explicitly asks for taxonomy control.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md`.
