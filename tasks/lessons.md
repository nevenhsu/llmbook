# Lessons Learned

## Workflow

- Non-trivial changes start with a plan in `tasks/todo.md` and end with verification evidence.
- After a user correction, update this file with the rule that would have prevented the mistake.
- Before claiming success, run targeted tests and/or focused typecheck on touched areas.
- If the user says "update docs first", finish the canonical doc and contract changes before continuing with code migration.
- If the user explicitly asks for a plan before refactoring, stop implementation work and deliver the confirmed plan first; do not continue reshaping the architecture in code until that plan is approved.
- For AI write paths, do not fail open when persona audit or repair breaks; if the system cannot produce a policy-compliant, audit-approved result, block the DB write instead of silently saving a weaker fallback.
- For non-trivial refactors that need confirmation, do not leave the plan as chat-only context; save the agreed approach under `/plans/*.md` before implementation starts.

## Prompt / AI Contracts

- When a prompt block must always be visible, use a fixed block with explicit empty fallback.
- If a feature has its own user-facing behavior, do not reuse another feature's eligibility helper or error wording without checking semantic fit.
- If malformed model output blocks debugging, surface the raw output instead of only returning a parse error.
- For persona prompt-assist features, do not genericize away named references; explicit creator/artist/public-figure/IP names are valid user intent and must be preserved when optimizing prompts.
- If a prompt-assist endpoint is expected to suggest references, do not rely on prompt wording alone; add a post-check that injects a real reference name when the model still returns abstract-only text.
- For persona prompt-assist, "better" means clearer persona dimensions plus at least one concrete reference name; do not treat a near-identical sentence with one appended name as a successful rewrite.
- If persona prompt-assist needs a random empty-state seed, sample a concrete reference name in application code and thread that same choice through generation and fallback; do not rely on the model to invent randomness consistently.
- If persona prompt-assist gets a non-empty brief without explicit references, choose a fitting reference in application code from the brief content before generation; do not fall back to unrelated random names for optimize mode.
- Short prompt-assist inputs that are really work/IP titles need explicit title normalization; do not feed raw titles like `one piece` through generic subject fallback or they become malformed phrases like `a one piece`.
- Persona prompt-assist must be reference-first across broad input types; treat works, eras, domains, styles, genres, countries, personalities, values, and claims as retrieval cues for suitable reference entities before rewriting the final brief.
- In reference-first prompt-assist, the final brief must be behaviorally shaped by the resolved reference; a generic persona sentence plus a pasted name is a failure even if the reference is technically present.
- For persona-generation modal timing, follow the requested footer layout exactly; elapsed time belongs on the bottom-left status area, not injected into the body when the user asks for action-row alignment.

## UI

- If loading belongs to a specific action, place the loading, timer, and error state at that exact interaction point.
- If a loading action must be cancelable, do not disable the button; convert it into an explicit cancel state.
- In joined input/button controls, match the button border/background/height to the input instead of using default outline styles.
- For Admin AI control-plane work, confirm the exact interaction surface; `Prompt AI` for persona generation lives in `/admin/ai/control-plane` under `Context / Extra Prompt`, not in the save/preview payload layer.
- If the user wants a standalone UI sandbox, mount it under `/preview/*` instead of inventing an admin-only route.
- If a preview needs large mock payloads, store the fixture in a dedicated JSON file and keep the TypeScript wrapper thin.
- If the user asks for a preview of an admin flow, reuse the real section and interaction states; do not collapse a modal/result fragment into a standalone page and call that the full flow.
- When extracting a DaisyUI modal into reusable pieces, preserve the `modal-box` + `modal-backdrop` contract and add a test for backdrop tint/visibility so the overlay does not silently disappear.
- If a preview flow is meant for UI review, mock async actions should preserve visible latency when the user is tuning loading states; do not make save/submit complete instantly unless they ask for that.
- When related actions share the same async behavior (`Generate`, `Regenerate`, `Save`), align their loading treatments and explicitly verify disabled states during in-flight transitions.
- For UI review surfaces, hide telemetry chrome like token stat bars unless the user explicitly wants diagnostics in that specific flow.
- For persona generation review, keep the main modal focused on generated results and move diagnostic prompt/token details behind an explicit `View Prompt` action instead of embedding them inline.
- When two admin modals belong to the same flow, match the modal shell itself, not just the content; reuse the same header/body/footer structure so the UI feels consistent during review.
- If a UI component becomes a generic shell, rename it generically instead of keeping feature- or area-specific naming that hides its reuse intent.
- If a component is genuinely reusable UI, place it in the shared UI folder instead of leaving it under a feature subtree after it becomes generic.
- When the user asks to remove visual chrome like white borders, prefer changing the local content cards first instead of weakening the shared modal shell used elsewhere.
- When adjusting border styling from feedback, distinguish between "remove the border" and "soften the border"; use a lighter neutral border before removing structure entirely.
- When a provider returns empty output in staged generation, inspect and raise the actual per-stage `maxOutputTokens` and retry caps; changing only the displayed budget will not fix the runtime behavior.
- When a preview fixture changes a budget or limit, search for matching hardcoded model metadata in the sandbox UI and update that too; stale preview constants make it look like nothing changed.
- If the same budget number affects runtime behavior and preview UI, store it in a shared reference module and have tests import that constant instead of repeating literals.
- If staged generation still fails on a provider after one budget bump, raise the shared per-stage ceilings and the global persona-generation output cap together; a low global cap silently cancels the stage-level increase.
- If a “View Prompt” action is meant to preview the template, do not gate it on successful generation; bind it to current form/policy state instead of resolved model output.
- If a template preview hides an important runtime-only block like `validated_context`, add an explicit placeholder in the template preview instead of making users infer where that block would appear.
- If a preview is meant to show a template rather than a resolved prompt, do not echo sample/mock prose inside blocks like `[admin_extra_prompt]`; use an explicit placeholder so examples are not mistaken for fixed system content.
- If a prompt preview contains multiple stages, render those stages as separate review units with expandable raw text instead of a single monolithic pre block.
- When an interaction should match DaisyUI patterns, prefer DaisyUI primitives like `collapse` over custom `details/summary` styling so the UI stays visually consistent with the rest of the app.
- When using collapsible stage cards, make the stage title row itself the collapse trigger; do not add a second "View raw prompt" row that forces an extra click target below the real heading.
- In review modals, put the primary content first and diagnostics second; if users are scanning stages, move `Token Budget` after the stage list instead of ahead of it.
- For semantic status badges, use neutral styling for data classifications like `canonical`; reserve success colors for true success/completion states.
- In structured preview sections like `Reference Sources`, keep contribution text as normal copy unless the user explicitly wants tag styling; bordered badges are too heavy for explanatory prose.
- In structured persona previews, keep descriptive prose sections like `Aesthetic Profile` as normal text lists; bordered tags work for metadata, not for taste/description copy.
- In structured persona previews, treat `Worldview` as prose, not metadata; render it as normal text instead of bordered tags.
- In persona profile cards, `Interaction Defaults` reads better as text lists than tag groups; use lists for strengths, triggers, and non-generic traits.
- If a section is meant to read as a list, add explicit list-style classes; plain `<ul><li>` without markers still looks like paragraph text in this UI.
- Keep structurally similar persona sections visually aligned: if `Interaction Defaults` uses text lists, `Guardrails` should also use text lists instead of reverting to tag-style metadata.
- If a preview field like `De-escalation Style` is stored as one comma-separated sentence but should read as a list, normalize it into multiple bullet items at render time.
- When splitting comma-separated prose into bullets, trim conjunctions like `and`/`or` from follow-up items so the resulting list reads naturally.
- If a preview-only navigation affordance is no longer part of the shared flow, remove the prop entirely instead of leaving a nullable escape hatch in the shared component API.
- If a button sits inside a DaisyUI `collapse-title`, assume it may still trigger the collapse; move non-toggle actions like copy buttons outside the clickable title hit area and test that they do not change the checkbox state.
- When placing custom actions beside a DaisyUI collapse title, leave enough space for the built-in arrow icon and its click area; otherwise the action visually collides with the affordance.
- Do not wrap DaisyUI `collapse-title` in an extra container; keep the expected direct child structure and solve adjacent action layout with absolute positioning instead.

## Data / Schema

- `supabase/schema.sql` should reflect final schema only; data repair belongs in migrations.
- Any migration that changes schema contract must be mirrored in `supabase/schema.sql`.
- When the user says "app" in this project, confirm whether they mean the AI agent runtime versus admin/UI surfaces before prioritizing implementation order.
- Selector inputs that support both chosen-value display and freeform search must treat the selected label as display-only text; never trigger search loading from that display text, and clear the selected value immediately when the user edits the field.
- If a selector shows a chosen value but should remain editable, never derive the input display solely from an open/closed dropdown flag; preserve the live query text and clear pending blur timers so delete-to-empty does not lock further typing.
- For search selectors backed by remote results, keep the last chosen option available locally while the edited query still matches it; otherwise trimming a selected handle can produce an empty dropdown even though the intended option is still the best match.
- Handle-style selector queries should normalize away leading @ before both local matching and remote search; otherwise editing an @ai_username produces false misses and empty dropdown states.
- For DaisyUI select controls in the admin control plane, prefer explicit focus border classes over `focus:select-primary`; otherwise focus state can remove the visible border instead of strengthening it.
- When a control style should match globally, prefer fixing the shared rule in globals.css and removing local overrides; otherwise inputs and selects drift into inconsistent focus states.
- If DevTools still shows a transparent focus border after a style change, replace nested theme-specific overrides with explicit final selectors in globals.css; relying on nested order is too fragile against compiled DaisyUI output.
- Once a global CSS override is proven, collapse verbose duplicate selectors into a single `:is(...)` form so the intent stays obvious and future edits do not fork the same rule in multiple places.
- If an admin action only surfaces system-default routing info without helping the operator complete the task, remove the action and its explanatory badge together instead of leaving a half-useful control in the UI.
- This repo's Vitest config only matches `src/**/*.test.ts`; new React DOM tests should still use the `.test.ts` suffix here, or they will be silently skipped.
- In summary cards that mix persona identity with reference metadata, keep the identity block first and move references below a divider; otherwise the card reads like one undifferentiated blob.
- Shared form controls still need per-surface defaults; for Interaction Preview, do not add a fake `Select model` option once a real model list already exists, and keep action-icon buttons pinned to the far edge of the label row.
- When a preview-only override UI is removed in active development, delete the matching hook state, API payload fields, route parsing, and store parameters in the same change; hiding the inputs alone leaves a dead contract behind.
- Small action buttons in dense admin forms should not default to `btn-ghost` when the action matters; use a subtle bordered/tinted style so the affordance is visible without overpowering the form.
- Do not wrap independent action buttons inside a `<label>` just to align a form row; the label expands the click target and makes the whole title area trigger the action.
- When a user asks for a control to feel more visible without looking “transparent,” use a neutral default border/text state and shift to `primary` on hover instead of relying on tinted backgrounds or lowered opacity.
- For assistive generation buttons tied to an editable text field, pass the current field content through the whole route/store path; otherwise the helper can only generate unrelated random output.
- For lightweight assist endpoints, a small output cap and no retry makes provider empty-output quirks too brittle; give them more headroom and retry once with a shorter prompt, but if the model still comes back empty, surface the explicit AI error instead of masking it with fallback text.
- When calling the shared `invokeLLM` wrapper, always pass prompt/token settings through `modelInput` plus `routeOverride/entityId`; mixing in ad hoc fields like `prompt` or `invocation` can silently turn a valid request into provider-level `EMPTY_PROMPT`.
- For short admin helper generations on MiniMax, keep the prompt terse and give the model more output headroom; a heavy instruction block plus low caps is more fragile than a compact prompt with `900+` output tokens.
- If an admin "preview" action is expected to show real model behavior, do not leave the result inline as a prompt-only stub; open the same modal-style async surface immediately, show loading/time there, and render the actual API-backed preview result inside that modal.
- If a preview run depends on user-provided context, disable the launch action while the context field is empty instead of allowing a click that only fails after the request path starts.
- If a run action operates on a specific text field, place that action directly under the field instead of leaving it in an earlier control row; the trigger should read as acting on that content, not on the whole form abstractly.
- In review modals, put the human-readable rendered result ahead of raw transport/debug blocks, and label the raw block by what it actually is (`Raw Response`) instead of the implementation format (`Markdown Output`).
- If an operator wants to inspect structured-output compliance, the raw-response panel must show the full model text before parsing, not the parsed markdown field after normalization.
- Preview sandboxes must preserve the same category-sensitive behavior as the real tool; if an AI helper changes output shape by task type in production, the `/preview` mock must also branch on task type instead of collapsing everything into one canned response.
- When renaming mock fixture exports during preview-sandbox refactors, immediately sweep all page/test imports; preview-only modules can still break the app build even if focused behavior tests pass.
- If a rendered preview block is something operators will copy into review or debugging workflows, give it the same explicit copy affordance as raw JSON and keep that copy action outside the collapse toggle hit area.
- In review modals, default-open only the primary human-readable result; keep diagnostic sections like prompt assembly, raw response, and token budget collapsed until the operator asks for them.
- If a modal is the main review surface for generated output, duplicate the key persona identity/reference card inside the modal itself; do not force operators to cross-reference the underlying form while reviewing the result.
- In preview review panels, move the entire telemetry row (`Render OK`, input usage, max out, compression badges) to the bottom under the main content and token-budget details; do not split one badge away from the rest of its row.
- If an operator needs to compare persona setup against generated output, put a copy affordance directly on the persona summary card and copy a compact JSON payload with identity plus reference data; do not force manual transcription from the UI.
- Default admin preview text should be concrete and domain-specific when the user is iterating on a known theme; do not leave a generic placeholder once the target scenario has clearly shifted.
- Keep default preview task type and default preview text semantically aligned; if the default scenario is "publish a post", do not leave the task type on comment response.
- If task category changes imply a different kind of seed content, update the default task-context text in the same interaction; do not leave a comment-oriented seed under post mode or vice versa.
- Do not let `taskType=post` inherit the `comment` output contract by convenience; post previews and runtime prompts must require post-shaped fields like `title` and `body`, because operators use raw response inspection to verify schema compliance.
- For AI-generated post tags, keep the LLM contract limited to raw hashtag strings (for example `#cthulhu`); derive storage-safe normalized tags in app code instead of asking the model for both forms.
- When a language-selection rule applies to one generated interaction contract, mirror it across sibling contracts like `post` and `comment`; otherwise operators get inconsistent multilingual behavior between closely related actions.
- If a structured LLM contract is strict enough that providers often miss one required field, do not silently relax the contract; keep the schema strict and add a focused repair retry that rewrites the first response into valid JSON.
- In interaction preview review UI, do not render post outputs as one undifferentiated markdown blob; label `Title`, `Tags`, and `Body` explicitly, while keeping comment previews body-only because they do not carry post fields.
- If interaction preview output includes image-generation fields, expose them in a dedicated review card with explicit `Need Image` true/false state and text-only prompt/alt fields; do not force operators to inspect raw JSON just to see whether an image was requested.
- Drift detection must keep shared rules generic; never hardcode one persona's framing words (for example Luffy-style `crew/loyalty/authority`) into the base detector. Pass persona-derived framing signals separately so other personas are not judged by the wrong voice markers.
