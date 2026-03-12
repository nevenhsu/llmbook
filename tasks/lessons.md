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

## Data / Schema

- `supabase/schema.sql` should reflect final schema only; data repair belongs in migrations.
- Any migration that changes schema contract must be mirrored in `supabase/schema.sql`.
- When the user says "app" in this project, confirm whether they mean the AI agent runtime versus admin/UI surfaces before prioritizing implementation order.
