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
- If prompt-assist output is expected to stay grounded in named references, the contract must require at least one explicit related reference name in the final brief; bare stylistic adjectives like Joycean are too lossy for debugging and operator trust.
- When prompt-assist may receive only a person name, character name, or work title as input, ground the audit and repair prompts in the original input itself; do not rely on regex name extraction as the semantic judge for whether the named reference was preserved.
- Semantic audit helpers must fail closed: if an audit returns empty or invalid JSON, do not silently treat that as `passes: true`, especially when the audit is the only guard preventing anonymous drift in LLM output.
- If prompt-assist semantics need tight control, split the flow: resolve references as a small JSON object first, audit/repair that JSON, then generate plain text separately and assemble any fixed source suffix in app code.
- In multi-stage LLM JSON flows, if a repair attempt returns empty output with `finishReason=length`, add one compact retry before surfacing an empty-output error; otherwise short structured payloads can fail just because the repair prompt itself was too verbose.
- If an audit transport fails twice but the upstream structured JSON already parsed and satisfied the deterministic contract, treat the audit as inconclusive instead of inventing a semantic failure from missing audit output.
- In staged preview generation, quality-repair retry logic must handle both truncation and empty/provider-error outputs; otherwise rate-limit/provider failures get mislabeled as invalid JSON without ever attempting a second repair.
- When a stage has a stable canonical key but models drift to a near-synonym wrapper like `creator_admiration`, absorb that harmless alias in the stage parser instead of surfacing a blocking missing-field error.
- In async multi-round batch hooks, keep the mutable rows ref synchronized immediately when applying row updates; if it only updates after React flushes state, later rounds will read stale eligibility and stop too early.
- Pause/resume for batch actions should resume from the current eligible set, not a stale saved queue slice; operators may have changed row eligibility while the batch was paused.
- If prompt-assist debugability matters, keep the last model output available as one canonical top-level error field (`rawText`) instead of duplicating it under aliases.
- When app code is supposed to parse JSON text itself, do not route the provider through a compatibility endpoint that performs stricter response-shape validation first; use the plain text endpoint/adapter instead.
- Once prompt-assist reference handling is moved to LLM resolution/audit/repair, remove any leftover regex-based skip paths that still decide whether optimize mode resolves named references; prompt shaping hints are fine, semantic branching is not.
- Once prompt-assist reference preservation is guaranteed by the resolver JSON stage plus final assembled suffix, do not reintroduce a second code-side name-matching gate against the free-text rewrite.

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
- If a batch-entry textarea starts dominating a toolbar card, move the input into a page-local modal and leave only a concise header plus open action in the page-level toolbar; only promote it to `shared/` when another flow genuinely reuses it.
- When a modal offers an auxiliary AI action for a textarea, keep the trigger next to the field as an icon-only control and reuse the footer helper line for elapsed text while that AI action runs.
- If an input card kicks off its own async action, show that elapsed status inside the same card near the input it belongs to instead of making operators look elsewhere for timing feedback.
- When the same label appears in both page chrome and a modal, target size/style changes at the exact surface the user named; do not assume the modal copy is the intended button.
- In persona-batch, the page-level `Add` button should stay aligned with the table/header control scale (`btn-sm`), while modal-local `Add` sizing is a separate decision.
- For inline action status near a button, keep result summary and elapsed time in separate UI slots; concatenating them into one text run makes alignment and scanability worse.
- Preview mocks should emulate the same async task phases as production UI; if the real surface shows loading and elapsed state, the preview mock must not complete synchronously and skip those states.
- Preview sandboxes should seed inputs with actionable defaults; if the default value is a no-op (for example, a duplicate batch-add input), operators will think the preview interaction is broken because the expected loading/timer state never appears.
- For modal-based batch add flows, do not let the footer summary snap back to `0 rows` after clearing the textarea; keep the last completed `added/duplicate` counts visible so operators can confirm what just happened.
- Modal-local completion summaries should reset on close/reopen; keep last-result feedback within the current open session, then return to neutral row-count state on the next open.
- If a modal summary mentions `duplicate` rows, its count must use the same source of truth as the table badges; mixing skipped-input counts with table duplicate status creates contradictory UI.
- Batch-add flows should not impose hidden row caps that the UI does not communicate, and any preview/mock row ids must come from a monotonic counter rather than `rows.length` so clear/add sequences cannot reuse React keys.
- If an AI affordance shows elapsed time during execution, keep the last completed elapsed value visible after completion instead of snapping back to helper copy; otherwise the status feels like it disappeared rather than completed.
- For chunked batch actions, pause semantics should stop only after the current chunk settles, then surface a resumable paused state with preserved elapsed time; do not fake pause by trying to abort in-flight row tasks.
- In paused chunked batch flows, do not reuse the same disabled-state rules as running tasks: paused should keep eligible bulk actions clickable so operators can resume the same task or switch to a different bulk action.
- If a batch run supports "pause after current chunk", the intermediate `pause requested` state must remain cancelable; show a clickable resume control there instead of disabling the pause button.
- Status text should match task phase and placement: inline with the action it belongs to, use present-participle labels while running (`Adding`, `Generating`) and completed labels after finish (`Added`, `Generated`, `Saved`).
- In batch workflows, bulk button enabled state must be driven by the same eligibility rules the queue uses; otherwise the UI claims an action is available while execution just skips every row.
- In batch duplicate-check flows, row `Clear`/duplicate removal should not automatically re-hit the check API if the remaining statuses can be recomputed from cached DB-exists results plus local duplicate counts.
- For data backfills tied to app-side normalization logic, keep schema migrations focused on structure and provide a dedicated script for reindex/backfill; do not bury application-specific rebuild logic in raw SQL unless the user explicitly wants SQL.
- When an API contract changes meaningfully (for example `normalized` becoming a romanized `matchKey`), update the shared type, route tests, hook consumers, preview mocks, and docs together; store-only changes leave hidden UI bugs behind.
- When adding a one-off maintenance script that users are expected to run, always add a named `npm run` alias and document that exact command; file paths alone are not enough UX.
- If scripts are meant to run against local `.env` values, fix the shared script runner to preload env files instead of relying on each script or the user shell to load them manually.
- After a one-off maintenance/backfill script has been run and is no longer part of the intended workflow, remove the script, npm alias, tests, and docs in the same cleanup pass so it does not become a stale supported path.
- If an AI API can fail after receiving non-empty model text, include that final LLM output in one canonical top-level error field so debug UI can distinguish contract validation failures from provider-empty responses.
- For prompt-assist, keep the final LLM output only as top-level `rawText`; do not duplicate the same text under another alias or nested debug field.
- For semantic quality gates in AI text flows, do not let regex be the final pass/fail judge; use LLM audit + repair, and keep regex only for lightweight hint extraction or prompt shaping.
- Shared preview repair caps must not be re-limited by the base stage budget; otherwise retries and quality repairs cannot actually buy recovery headroom for truncated JSON.
- If a compact stage retry still ends with `finishReason=length`, add one final truncation-rescue rewrite before surfacing the failure; otherwise the operator only sees misleading invalid-JSON or missing-field errors.
- When model output auto-seeds persona identity, normalize the generated display name in one shared helper before deriving persona usernames, but never mutate manual identity edits through that formatter.
- If a preview sandbox reimplements a batch state machine locally, it must mirror the production hook's eligibility, pause/resume, and auto-rerun semantics; otherwise the preview becomes a misleading debug surface.
- If a shared destructive header action expands beyond its old scope, rename the backing controller method and update the tooltip text at the same time; leaving duplicate-only names after adding saved-row removal creates misleading UI and test drift.
- If a page and its preview sandbox share an operational default like batch chunk size, lock that default in focused tests on both surfaces; otherwise one side silently drifts when the constant changes.
