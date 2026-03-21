# Lessons Learned

## Workflow

- Non-trivial work starts with a plan in `tasks/todo.md` and ends with verification evidence.
- After a user correction, update this file with the rule that would have prevented the mistake.
- Before claiming success, run targeted tests and focused checks on the touched area.
- If the user says "update docs first", finish the canonical docs and contract wording before continuing code migration.
- If the user explicitly asks for a plan before refactoring, stop implementation and save the confirmed plan under `/plans/*.md` before changing code.
- For AI write paths, do not fail open when schema, persona audit, or repair breaks; block DB-backed actions instead of saving a weaker fallback.
- When renaming a shared runtime contract like `agent_soul` -> `agent_core`, carry the rename through related filenames and exported module APIs instead of stopping at prompt block strings.

## Prompt / AI Contracts

- When a prompt block must always be visible, use a fixed block with an explicit empty fallback.
- If malformed model output blocks debugging, surface the raw output instead of only returning a parse error.
- Persona-specific voice/framing compliance should be judged by a shared LLM audit contract, not by hardcoded persona keywords in app logic.
- Shared persona-example builders must stay neutral; never bake one reference persona's slang or role words into the common template layer.
- For persona prompt-assist, preserve named references; explicit creators, artists, public figures, fictional characters, and IP names are valid user intent.
- Prompt-assist should be reference-first across broad input types; works, eras, domains, styles, genres, countries, values, and claims are retrieval cues for suitable references.
- In reference-first prompt-assist, a generic sentence plus a pasted reference name is still a failure; the resolved reference must shape behavior and voice.
- Do not let `taskType=post` inherit the `comment` output contract by convenience; post prompts and previews must require post-shaped fields like `title`, `body`, and `tags`.
- For AI-generated post tags, keep the LLM contract limited to raw hashtags; normalize storage-safe tags in app code.
- When a language rule applies to one interaction contract, mirror it across sibling contracts like `post` and `comment`.
- If a structured LLM contract is strict enough that providers often miss one field, keep the schema strict and add a focused repair retry rather than silently relaxing the contract.
- Drift detection must keep shared rules generic; do not hardcode one persona's framing words into base detectors.
- Interaction preview token budgets should be task- and stage-specific; `post` generation and persona audit need more headroom than `comment`, and empty audit output should retry once with a compact audit prompt before failing.
- If persona audit structured output can be truncated or malformed, compact audit retry must cover invalid JSON too; empty-output retry alone is insufficient.
- When raising interaction-preview token budgets, prefer one generous shared budget profile per task/stage across providers; do not add provider-specific budget branches unless the user explicitly asks for them.
- If persona distinctiveness depends on how `post` and `comment` should open, attack, praise, and close, persist that style behavior in canonical `persona_core` fields instead of leaving runtime to infer it from broad traits.
- In persona generation, style-bearing canonical fields like `voice_fingerprint`, `interaction_defaults`, and `task_style_matrix` must be natural-language reusable guidance, not enum-like machine labels that only satisfy schema shape.
- When `Generate Persona` and `Update Persona` share the same staged generation pipeline after prompt seeding, persona-quality rules like originalization and anti-cosplay checks must be enforced in the shared generation path so both modes improve together.
- If anti-cosplay quality rules protect the seed identity, extend the same protection to `persona_memories`; otherwise literal reference roleplay can leak back in through canonical memories even when the top-level persona is originalized.
- After making persona-generation stage outputs more natural-language and verbose, re-evaluate the affected stage budgets and retry caps; otherwise later stages like `interaction_and_guardrails` can start truncating valid content into parse failures.
- When prompt helpers only support `post` / `comment`, explicitly map `vote` / `poll_*` task types to a safe generic path instead of piping unsupported task types into post/comment-only runtime helpers.

## UI

- If the user wants a standalone UI sandbox, mount it under `/preview/*`.
- If the user asks for a preview of an admin flow, reuse the real section and modal states instead of building a fake simplified flow.
- Preview sandboxes must preserve production-sensitive branching such as task-type-specific output shapes.
- If a preview flow is meant for UI review, mock async actions should keep visible latency unless the user asks for instant completion.
- If a run action depends on a specific text field, place the trigger directly under that field and disable it while the field is empty.
- In review modals, put the human-readable result first and diagnostics second.
- If operators need to inspect structured-output compliance, show the full raw model response before parsing.
- Default-open only the primary result section in review modals; keep diagnostics collapsed.
- If a modal is the main review surface, duplicate the persona identity/reference card inside the modal so operators do not need to cross-reference the form.
- If an operator needs to compare persona setup against output, put a copy affordance directly on the persona summary card and on the rendered preview.
- In interaction preview UI, render post outputs as explicit `Title`, `Tags`, and `Body` sections; keep comment previews body-only.
- If interaction preview output includes image-generation fields, expose them in a dedicated review card with explicit `Need Image` true/false state.
- When a preview-only override UI is removed in active development, delete the matching state, payload fields, route parsing, and store parameters in the same change.
- In admin regenerate/update flows, do not auto-link `display_name` and `username`; let operators edit both independently and block submit when the persona username fails `ai_` validation.
- If an update flow only seeds `Context / Extra Prompt` from an existing record, keep the same prompt/template pipeline after that seed; do not introduce a separate update-only prompt assembly path.
- When a persona summary card is reused across generation, update, and interaction flows, promote it to a generic shared component/file name instead of leaving an interaction-specific name behind.
- Admin persona profile reads that feed operator UI cards should degrade to the raw stored `persona_core` when strict normalization fails, so identity/reference metadata still renders during schema transitions.
- When a selected entity drives async profile fetches for UI metadata, clear the old profile-derived state immediately on id change so stale references do not linger while the next fetch is in flight.
- If an update form only differs by seeded context, its prompt-assist path should reuse the same helper as create/generate mode instead of cloning the same request logic under a second handler.
- When create/update admin cards converge on the same model/prompt/assist structure, extract a shared UI component and keep only the mode-specific fields/actions as props.
- If the user specifies a repo-wide shared location like `src/mock-data`, move JSON fixtures there instead of inventing a narrower feature-local mock-data folder.
- In persona generation/update review modals, any editable identity card must read from the same `display_name` / `username` form state as the inputs; preview API output can seed defaults but must not remain the card's source of truth.
- Persona username inputs in admin Generate/Update flows should normalize on input, not just validate on save: always enforce `ai_`, lowercase, and strip invalid characters as the user types.
- If profile usernames, persona usernames, and derived/autofilled usernames share the same character rules, keep one common normalization helper and reuse it everywhere instead of maintaining parallel sanitizers in UI components.
- When a shared behavior contract changes across profile/persona/admin flows, update the corresponding spec docs in the same change instead of only updating code and lessons.
- When persona username input is normalized on the client, mirror the same normalization in backend create/update/check APIs; otherwise admin persona writes and availability checks drift from the UI contract.
- If an admin prompt field is expected to hold seeded bio/reference context plus manual edits, use a textarea instead of a single-line input so the UI contract matches the content shape.
- For admin prompt-assist flows, never paper over empty or weak model output with local fallback prose; surface the error so operators know the assist failed instead of saving fabricated text.
- For admin prompt-assist flows, "no local fallback" does not mean "no repair": if the main rewrite returns empty, give the model one explicit empty-output repair attempt before surfacing the error.
- When an admin AI helper can fail for multiple reasons, keep the API error typed with a stable `code`; otherwise provider timeouts, empty model text, and contract-validation failures all collapse into the same misleading generic message.
- When typed AI-helper errors are still too opaque for debugging, include the final LLM-attempt diagnostics (`attemptStage`, `providerId`, `modelId`, `finishReason`, `hadText`) in error details instead of forcing operators to infer where the empty output happened.
- If prompt-assist diagnostics show `finishReason=length` with `hadText=false`, treat output headroom as a likely root cause and raise the shared prompt-assist cap before assuming the model simply returned blank text.
- In prompt-assist, non-empty output is not automatically valid; if the last attempt ends with `finishReason=length` or a dangling clause like a trailing conjunction, repair truncation once before returning text to the UI.
- For prompt-assist, if the user already supplied an explicit reference name, treat "descriptive paraphrase with no visible name" as a contract failure; preserve the original name when possible, or make a related replacement name explicit.
- If a prompt-assist contract depends on preserving explicit source names, inject those names into the main rewrite and every repair prompt up front; do not rely on a final validator or a last-ditch repair to reintroduce them.
- If truncation repair returns blank text, surface that as a repair-stage empty-output failure with `truncated_output_repair` details; do not fall through and misreport the stale `main_rewrite` truncation metadata.
- If MiniMax prompt-assist still ends with `finishReason=length` after one headroom bump, raise the shared cap decisively rather than nudging it by another small increment.
- Admin staged previews should not inherit high provider retry counts from general runtime policy; they already have stage-local repair loops, so provider retries only multiply latency.
- Keep the reliability split explicit: admin preview/assist flows should usually fail fast with low provider retries, while production runtime / agent execution paths should keep their normal retry policy unless the user explicitly asks otherwise.
- If the user says preview stage budgets are already correct, do not keep tuning output caps; look for lower-risk latency wins like compacting internal prompt context or removing duplicated retries.
- Shared username normalization should preserve pasted word boundaries by converting whitespace to underscores; stripping spaces outright makes display-name-derived usernames unreadable.
- When a user asks whether a tuning change like a token cap was actually applied, answer with the exact current numeric value and file location, not only a qualitative summary.
- Helper copy in admin cards should stay short and scannable; if the behavior is simple, do not pack multiple caveats into one long status sentence.
- When the preview generate-persona modal's structured data contract changes, update the corresponding modal UI mapping in the same change; do not leave the review surface on stale field wiring.
- If an admin AI helper shows elapsed status while running, preserve a separate completed state and final elapsed time after success; otherwise the UI will fall back to idle helper copy too early.
- When create/update cards share one prompt-assist status component, add regression coverage for both cards; otherwise it is easy to verify the update card and miss the create card's fallback-to-idle behavior.
- If an operator asks for modal review cards to stay in one vertical order, remove the responsive multi-column grid classes from the shared preview components themselves; changing only the modal shell will not stop nested cards from reflowing side by side.
- When adding new hook-return fields to a panel and forwarding them to child props, update the hook destructuring in the parent immediately; otherwise the page can still compile in pieces but crash at runtime with a missing local binding.
- For staged LLM JSON contracts in active development, once the user chooses the canonical key shape, migrate every prompt/parser/UI/test/doc consumer to that shape instead of preserving singular/plural aliases.
- After a canonical contract migration lands, sweep tests/docs/review notes for stale examples of the old shape; leaving outdated fixtures or historical notes behind will keep reintroducing the wrong contract.
- Persona generation has a stricter language contract than prompt-assist: the shared staged generation prompt must explicitly force English output regardless of global policy language or admin extra-prompt language, or models will drift to the user's input language.
- Once persona generation is contractually English-only, do not keep multilingual prose acceptance logic around; add a shared English-only quality gate for generated prose and only exempt explicit reference names from non-English rejection.
- In staged persona-generation parsing, every schema miss that depends on raw model output must be wrapped as `PersonaGenerationParseError`; if one helper leaks a plain `Error`, the API falls back to `result: null` and throws away the debugging artifact.
- For staged persona-generation parsing, one-layer `result`/`output` wrappers are still reasonable to unwrap, but singular/plural key aliases should be removed once the canonical contract is explicitly chosen.
- For persona-generation preview failures, do not expose a parser/debug payload only on some paths or under ambiguous names like `rawOutput`; return one canonical `result` field from the API and have the admin modal read that same field directly.
- When preview error `result` clearly shows a stage JSON was cut off mid-object, treat it as a truncation problem first: raise the affected stage headroom and use a truncation-specific retry prompt before chasing parser aliases or schema changes.
- For `interaction_and_guardrails`, truncation fixes need stage-specific compression rules, not only generic “be shorter” wording; explicitly constrain heavy list fields and remind the model that `voice_fingerprint.closing_move` is a single string, not an array.
- Seed-stage originalization validation should judge meaning, not one literal phrase like `forum-native`; accept notes that clearly describe a transformed original identity/voice/persona even if they use wording like `rather than being`, `not an imitation`, or `internalized`.
- Seed-stage originalization validation should stay English-only and generic: accept contrast/adaptation wording like `unlike`, `different space than`, or `not a literal reenactment`, but do not hardcode multilingual keywords or reference-specific nouns into the semantic rule.
- When a language contract is already English-only, remove stale multilingual semantic cues from docs/tasks too; leaving review notes that still mention multilingual acceptance will cause the validator to drift back later.
- When a persona quality rule is fundamentally semantic, do not let a regex be the final pass/fail gate; keep deterministic checks for concrete violations, then hand the semantic judgment to a compact LLM audit that returns repairable issues.
- Apply that split consistently across persona-generation stages: if seed originalization moved to semantic audit, memories-stage forum-native-vs-roleplay judgment should not stay behind as a brittle keyword pattern.

## Data / Schema

- `supabase/schema.sql` should reflect the final schema only; data repair belongs in migrations.
- Any migration that changes schema contract must be mirrored in `supabase/schema.sql`.
- When the user says "app" in this project, confirm whether they mean the AI runtime or admin/UI surfaces before prioritizing work.
- For Supabase upserts keyed by a non-primary unique constraint like `persona_cores.persona_id`, always pass the explicit `onConflict` column list; default upsert targeting can fall back to primary-key behavior and trigger duplicate-key errors on updates.
- In this repo's active-development stage, shared mock/preview loaders should consume the latest contract shape directly; do not add legacy shape fallbacks unless the user explicitly asks for compatibility.
- If the user decides the canonical shape itself is wrong, finish the full contract migration instead of keeping a parser alias; latest-contract-only means prompts, parsers, UI, fixtures, tests, and docs should all converge on the new singular/plural choice together.
- This repo's Vitest config only matches `src/**/*.test.ts`; new React DOM tests still need the `.test.ts` suffix.
