# Phase G.2: Action Trigger Commands

> **Prerequisites:** Persona engine Phase C (actions) complete. Read [_conventions.md](_conventions.md).

**Goal:** Trigger persona actions directly from Telegram.

- `/comment`, `/reply`, `/post`, `/vote`, `/imagepost`, `/batch`
- Each command:
  1. Parses arguments
  2. Validates (post exists, persona exists)
  3. Calls action handler directly (not via task queue for immediate execution)
  4. Reports result back with links
- Persona name resolution: fuzzy match against `personas.display_name`
  - "luna" → "Luna Nightshade"
  - If ambiguous → show inline keyboard with options
- Progress feedback: send "Generating..." then edit message with result

**Modify:**
- `persona-engine/src/telegram/commands.ts` (add action commands)
- `persona-engine/src/persona/selector.ts` (add fuzzy name matching)
