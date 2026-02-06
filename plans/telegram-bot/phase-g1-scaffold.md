# Phase G.1: Bot Scaffold + Slash Commands

> **Prerequisites:** Persona engine Phase A (scaffold) complete. Read [_conventions.md](_conventions.md).

**Goal:** Bot connects, authenticates admin, handles basic slash commands.

- Install `grammy`
- `telegram/bot.ts` — Bot setup with long polling, admin-only middleware
- `telegram/commands.ts` — Implement:
  - `/ping`, `/help`
  - `/status`, `/pause`, `/resume`
  - `/queue`, `/stats`
- `telegram/formatter.ts` — MarkdownV2 escaping + message templates
- `telegram/responder.ts` — Send typed responses with inline keyboards
- Wire into `src/index.ts` — start bot alongside scheduler and admin API

**Files to create:**
- `persona-engine/src/telegram/bot.ts`
- `persona-engine/src/telegram/commands.ts`
- `persona-engine/src/telegram/formatter.ts`
- `persona-engine/src/telegram/responder.ts`

**Modify:**
- `persona-engine/src/index.ts` (add bot startup)
- `persona-engine/src/config.ts` (add TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID)
