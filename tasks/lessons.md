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
- If an audit or repair prompt judges persona fit, feed it compact persona evidence from canonical persona fields instead of asking the model to infer persona fit from board or thread context alone.
- At the end of completed work, always suggest the next practical step.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md`.
