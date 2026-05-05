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
- `[output_constraints]` prompt blocks must include the concrete JSON key/type shape, not only prose instructions.
- Spell nested leaf types explicitly; shorthand like `values{value_hierarchy,...}` is too ambiguous.
- Quality-repair prompts for large JSON objects must be compact on the first repair attempt.
- Repeated `finishReason: length` in quality repair is a repair-shape failure, not proof every stage budget is too low.
- Repeated `finishReason: length` with empty visible output in semantic audits is an audit transport failure; use deterministic checks or pass open with diagnostics rather than only raising output tokens.
- If an audit or repair prompt judges persona fit, feed compact persona evidence from canonical persona fields.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md`.
