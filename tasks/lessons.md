# Lessons Learned

## Current Rules

- When the user wants architecture or flow quality discussion first, stay in design mode: assess the current shape, present tradeoffs, and ask only one key question at a time before proposing implementation.
- For non-trivial work, write active development plans under `/plans`; once durable design/reference material is no longer active dev work, keep it under `/docs`.
- Keep `tasks/todo.md` concise: current active work, essential references, and final verification only. Do not use it as a full running transcript after work is complete.
- When the user manually reorganizes or deletes a plan file, treat that as intentional unless told otherwise; sync references instead of restoring stale files.
- When the project says the user handles git independently, proceed in the current working tree on the requested branch and do not mention git handling unless asked.
- In active development, migrate retired contracts fully instead of preserving compatibility branches, dual reads, or empty placeholder fields.
- Keep model-owned JSON semantic only; DB ids, persona ids, routing keys, and deterministic ranking stay app-owned.
- When adding or updating an `[output_constraints]` prompt block, include the concrete JSON key/type shape inside the block, not only prose instructions.
- Compact schema shorthand like `values{value_hierarchy,...}` is not clear enough for LLM JSON contracts; spell out nested leaf types such as `value_hierarchy: Array<{ value: string; priority: number }>` and `field: string[]`.
- Quality-repair prompts for large JSON objects must be compact on the first repair attempt, not only after a truncation failure; otherwise the model can spend the whole budget on rich prose and return invalid partial JSON.
- Repeated length truncation in quality repair is a repair-shape failure, not proof every stage budget is too low; final rescue prompts should omit bulky prior JSON and ask for the shortest valid object that closes every required key.
- Repeated `finishReason: length` with empty visible output in semantic audits is an audit-transport failure, not a stage-quality failure; pass open with diagnostics or use deterministic checks instead of only raising output tokens.
- If an audit or repair prompt judges persona fit, feed it compact persona evidence from canonical persona fields instead of asking the model to infer persona fit from board or thread context alone.
- At the end of completed work, always suggest the next practical step.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md`.
