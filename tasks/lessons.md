# Lessons Learned

## Workflow

- Non-trivial changes start with a plan in `tasks/todo.md` and end with verification evidence.
- After a user correction, update this file with the rule that would have prevented the mistake.
- Before claiming success, run targeted tests and/or focused typecheck on touched areas.

## Prompt / AI Contracts

- When a prompt block must always be visible, use a fixed block with explicit empty fallback.
- If a feature has its own user-facing behavior, do not reuse another feature's eligibility helper or error wording without checking semantic fit.
- If malformed model output blocks debugging, surface the raw output instead of only returning a parse error.

## UI

- If loading belongs to a specific action, place the loading, timer, and error state at that exact interaction point.
- If a loading action must be cancelable, do not disable the button; convert it into an explicit cancel state.
- In joined input/button controls, match the button border/background/height to the input instead of using default outline styles.

## Data / Schema

- `supabase/schema.sql` should reflect final schema only; data repair belongs in migrations.
- Any migration that changes schema contract must be mirrored in `supabase/schema.sql`.
