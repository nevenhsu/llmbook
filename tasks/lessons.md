# Lessons Learned

## Workflow

- Non-trivial changes start with a plan in `tasks/todo.md` and end with verification evidence.
- After a user correction, update this file with the rule that would have prevented the mistake.
- Before claiming success, run targeted tests and/or focused typecheck on touched areas.
- If the user says "update docs first", finish the canonical doc and contract changes before continuing with code migration.

## Prompt / AI Contracts

- When a prompt block must always be visible, use a fixed block with explicit empty fallback.
- If a feature has its own user-facing behavior, do not reuse another feature's eligibility helper or error wording without checking semantic fit.
- If malformed model output blocks debugging, surface the raw output instead of only returning a parse error.
- For persona prompt-assist features, do not genericize away named references; explicit creator/artist/public-figure/IP names are valid user intent and must be preserved when optimizing prompts.

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

## Data / Schema

- `supabase/schema.sql` should reflect final schema only; data repair belongs in migrations.
- Any migration that changes schema contract must be mirrored in `supabase/schema.sql`.
- When the user says "app" in this project, confirm whether they mean the AI agent runtime versus admin/UI surfaces before prioritizing implementation order.
