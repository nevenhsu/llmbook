# Lessons Learned

## Workflow

- Start non-trivial work with a concrete plan, keep `tasks/todo.md` current, and verify the touched area before claiming completion.
- After a user correction, only keep the reusable rule that would have prevented the mistake; delete stale historical notes.
- When refactoring a large file, extract modules and remove the old duplicated in-file helpers in the same pass so the architecture actually gets simpler.

## Contracts And AI Flows

- In active development, use the latest contract only. Migrate prompts, parsers, UI, fixtures, tests, and docs together instead of adding compatibility paths.
- For staged LLM JSON flows, fail closed on schema and quality errors, and surface the raw model `result` on parse failures whenever possible.
- Persona generation is English-only for generated prose; explicit reference names are the only non-English exception.
- Keep deterministic checks for concrete violations, but hand semantic judgments like originalization and anti-cosplay/forum-native memory quality to compact LLM audits rather than brittle regexes.
- When a structured stage is truncated, treat it as a truncation problem first: raise the right headroom and use truncation-aware repair before relaxing the contract.
- Preview error payloads for staged LLM flows should surface the last attempt diagnostics (`stageName`, `attemptStage`, `finishReason`, provider/model, attempts) alongside the canonical `result`, otherwise operators cannot tell truncation from schema drift.
- Stage parsers should report stage-local field paths and tolerate harmless stage-local shape drift where meaning is still recoverable; do not surface a Stage 2 payload error as if the final `persona_core.*` object were already missing.
- Admin preview and assist flows should be low-retry and latency-sensitive; production runtime and agent execution keep their normal reliability-oriented retry policy.
- If prompt-assist depends on preserving user-supplied reference names, inject those names into the main prompt and repair prompts up front rather than hoping a final validator can recover them.

## Architecture And UI

- Shared contracts and types should live outside store/facade files; LLM orchestration belongs in dedicated services, and the store should stay a thin persistence layer.
- Reuse real admin flows in preview sandboxes; when a shared UI contract changes, update the real surface, mock data, and regression tests together.
- If an update flow seeds prompt context from async profile/reference data, keep its run/assist actions disabled until that profile fetch resolves; otherwise operators can act on empty or stale context.
- Shared username normalization must preserve word boundaries by converting whitespace to underscores; persona usernames then normalize into the `ai_` namespace.
- Keep the ownership map current in [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md) so future AI agent work lands in the right module.
- In batch persona flows, immutable reference names and editable persona identity are different state sources: reference drives duplicate-check eligibility, but row identity is the only source of truth when saving.
- Shared debug/review UI like API error inspection, persona data viewing, and task/time badges should live outside admin-specific folders so new agent flows can reuse them directly.
- If a shared persona modal needs an identity/reference summary, reuse the existing control-plane persona card instead of hand-rolling a second summary UI, and derive its reference list from canonical `personaData.reference_sources`.
- Optional-chaining booleans should be wrapped with `Boolean(...)` or `?? false`; checks like `foo?.bar !== null` can accidentally open UI when `foo` is still `undefined`.
- In batch/table workflows, controls that act on the whole table belong in the table header area, not mixed into the data-entry toolbar above it.
- In dark-theme data tables, add explicit cell borders with stronger contrast; relying on only the outer card border makes row and column dividers disappear.
- Dense admin tables should preserve horizontal breathing room with an explicit table `min-width`, and secondary action buttons should stay short with visible outline borders.
- If a shared persona modal is used in batch workflows, keep a compact identity/reference summary card above the structured preview so operators can verify row names and source references without scanning the full JSON-derived sections.
- Batch-add flows should filter names already present in the table before inserting, then immediately re-check the full table so duplicate status stays globally consistent after each add/remove operation.
- Batch header controls should keep destructive actions in the same row as primary actions, use a single tooltip direction consistently, and any copy-to-clipboard affordance should show immediate toast feedback.
- If a row action has a dedicated editor modal, expose the same row-level assist entry point inside that modal and keep the action label consistent between the table and the modal.
- Preview sandbox pages should include an explicit reset affordance and auto-finish mock loading states; preview-only controls must not get stuck in perpetual spinners.
- In table workflows, destructive `Clear` actions should keep the same error styling across header-level and row-level controls; mixed warning/error tones make the action hierarchy inconsistent.
- In persona-batch rows, edit affordances should respect data validity: duplicate references cannot edit context prompts, and persona identity should stay locked until persona data exists.
- In toolbar layouts with a trailing single action, do not let the flex column stretch the button full width; explicitly right-align the action container and the button itself.
- When a modal offers an auxiliary AI action for a textarea, keep the trigger next to the field as an icon-only control and reuse the footer helper line for elapsed text while that AI action runs.
- If an input card kicks off its own async action, show that elapsed status inside the same card near the input it belongs to instead of making operators look elsewhere for timing feedback.
- For inline action status near a button, keep result summary and elapsed time in separate UI slots; concatenating them into one text run makes alignment and scanability worse.
- Preview mocks should emulate the same async task phases as production UI; if the real surface shows loading and elapsed state, the preview mock must not complete synchronously and skip those states.
- Preview sandboxes should seed inputs with actionable defaults; if the default value is a no-op (for example, a duplicate batch-add input), operators will think the preview interaction is broken because the expected loading/timer state never appears.
- Batch-add flows should not impose hidden row caps that the UI does not communicate, and any preview/mock row ids must come from a monotonic counter rather than `rows.length` so clear/add sequences cannot reuse React keys.
- If an AI affordance shows elapsed time during execution, keep the last completed elapsed value visible after completion instead of snapping back to helper copy; otherwise the status feels like it disappeared rather than completed.
- For chunked batch actions, pause semantics should stop only after the current chunk settles, then surface a resumable paused state with preserved elapsed time; do not fake pause by trying to abort in-flight row tasks.
- In paused chunked batch flows, do not reuse the same disabled-state rules as running tasks: paused should keep eligible bulk actions clickable so operators can resume the same task or switch to a different bulk action.
- Status text should match task phase and placement: inline with the action it belongs to, use present-participle labels while running (`Adding`, `Generating`) and completed labels after finish (`Added`, `Generated`, `Saved`).
- In batch workflows, bulk button enabled state must be driven by the same eligibility rules the queue uses; otherwise the UI claims an action is available while execution just skips every row.
- In batch duplicate-check flows, row `Clear`/duplicate removal should not automatically re-hit the check API if the remaining statuses can be recomputed from cached DB-exists results plus local duplicate counts.
- For data backfills tied to app-side normalization logic, keep schema migrations focused on structure and provide a dedicated script for reindex/backfill; do not bury application-specific rebuild logic in raw SQL unless the user explicitly wants SQL.
- When an API contract changes meaningfully (for example `normalized` becoming a romanized `matchKey`), update the shared type, route tests, hook consumers, preview mocks, and docs together; store-only changes leave hidden UI bugs behind.
- When adding a one-off maintenance script that users are expected to run, always add a named `npm run` alias and document that exact command; file paths alone are not enough UX.
- If scripts are meant to run against local `.env` values, fix the shared script runner to preload env files instead of relying on each script or the user shell to load them manually.
- After a one-off maintenance/backfill script has been run and is no longer part of the intended workflow, remove the script, npm alias, tests, and docs in the same cleanup pass so it does not become a stale supported path.
- If an AI API can fail after receiving non-empty model text, include that final LLM output in the canonical error payload (`result`) so debug UI can distinguish contract validation failures from provider-empty responses.
- If an API surfaces the final LLM output as top-level `result`, do not also expose the same text again inside nested debug details; keep one canonical copy in the response contract.
- For semantic quality gates in AI text flows, do not let regex be the final pass/fail judge; use LLM audit + repair, and keep regex only for lightweight hint extraction or prompt shaping.
- Shared preview repair caps must not be re-limited by the base stage budget; otherwise retries and quality repairs cannot actually buy recovery headroom for truncated JSON.
- If a compact stage retry still ends with `finishReason=length`, add one final truncation-rescue rewrite before surfacing the failure; otherwise the operator only sees misleading invalid-JSON or missing-field errors.
- When model output auto-seeds persona identity, normalize the generated display name in one shared helper before deriving persona usernames, but never mutate manual identity edits through that formatter.
