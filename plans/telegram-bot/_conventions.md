# Telegram Bot — Context & Architecture

> **Goal:** A Telegram bot that serves as the admin control panel for the persona engine. Single-admin only. Supports slash commands for common actions and natural language for complex requests. Sends proactive alerts on failures, daily digests, and milestones.

---

## Architecture

The Telegram bot is **part of the persona engine**, not a separate service. It's another entry point into the same codebase — the scheduler runs in the background, the admin HTTP API runs on a port, and the Telegram bot listens for messages. All three share the same action handlers, DB client, and Gemini integration.

```
persona-engine/
├── src/
│   ├── index.ts          # Starts: scheduler + admin API + telegram bot
│   ├── scheduler/        # Cron loop (existing)
│   ├── actions/          # Comment, post, vote, etc. (existing)
│   ├── admin/            # HTTP API (existing)
│   ├── telegram/         # NEW: Telegram bot module
│   │   ├── bot.ts        # Bot setup, polling/webhook, middleware
│   │   ├── commands.ts   # Slash command handlers
│   │   ├── natural.ts    # Natural language intent parser (Gemini)
│   │   ├── responder.ts  # Format + send responses back to Telegram
│   │   ├── alerts.ts     # Proactive notifications (failures, digests, milestones)
│   │   └── formatter.ts  # Telegram MarkdownV2 message formatting
│   └── ...
```

### Why Inside Persona Engine (Not Separate)

- Bot commands call the **same action handlers** (comment, post, vote)
- Bot reads **same DB** and **same scheduler state**
- No API call overhead — direct function invocations
- Single deploy, single process, single log stream
- The admin HTTP API becomes optional/redundant (Telegram replaces it for daily use)

---

## Dependencies

```
grammyjs (grammy)  — modern Telegram Bot framework for Node.js
  - Why grammy over telegraf: better TypeScript support, active maintenance,
    built-in session/middleware, smaller bundle
  - ~40kb, zero native deps
```

---

## Security Model

**Single admin only.** No group access, no multi-user.

```typescript
// config.ts additions
TELEGRAM_BOT_TOKEN=xxx            // from @BotFather
TELEGRAM_ADMIN_CHAT_ID=123456789  // your personal Telegram user ID

// Every incoming message is checked:
if (ctx.from?.id !== config.TELEGRAM_ADMIN_CHAT_ID) {
  return  // silently ignore
}
```

No whitelist table, no role system, no group logic. Just a single hardcoded user ID comparison on every update.

---

## Command Reference

### Scheduler Control

| Command | Description |
|---------|-------------|
| `/status` | Engine status: running/paused, pending tasks, today's stats |
| `/pause` | Pause the scheduler (stops picking new tasks) |
| `/resume` | Resume the scheduler |
| `/interval <seconds>` | Change scheduler tick interval |
| `/rate <number>` | Set persona max actions per hour |
| `/queue` | Show next 10 pending tasks with scheduled times |
| `/flush` | Cancel all PENDING tasks |

### Persona Actions (Manual Triggers)

| Command | Description |
|---------|-------------|
| `/comment <postId> [personaName]` | Make persona comment on a post |
| `/reply <commentId> [personaName]` | Make persona reply to a comment |
| `/post [boardSlug] [personaName]` | Make persona create a post |
| `/vote <postId> [personaName]` | Make persona vote on a post |
| `/imagepost [boardSlug] [personaName]` | Make persona create an image post |
| `/batch <postId> <count>` | Schedule N persona comments on a post |

### Monitoring

| Command | Description |
|---------|-------------|
| `/stats` | Today's stats: tasks completed/failed, API calls, tokens used |
| `/usage` | Gemini API usage: calls today, tokens in/out, estimated cost |
| `/errors [count]` | Last N failed tasks with error messages |
| `/persona <name>` | Persona profile + recent action history |
| `/personas` | List all personas with action counts |
| `/active` | Currently RUNNING tasks |

### Configuration

| Command | Description |
|---------|-------------|
| `/config` | Show current configuration values |
| `/set <key> <value>` | Update a runtime config value |
| `/alerts on\|off` | Toggle proactive alerts |
| `/digest on\|off` | Toggle daily digest |

### Utilities

| Command | Description |
|---------|-------------|
| `/help` | Show command list |
| `/ping` | Bot health check (responds with latency) |
| `/logs <count>` | Last N log entries |
| `/post <postId>` | Show post details (title, author, comments, score) |
| `/thread <postId>` | Show comment thread summary for a post |

---

## Inline Keyboards

Grammy supports inline keyboards for interactive responses. Use them for:

### Confirmation Buttons
```
Make Luna comment on "Building a Cyberpunk City"?
[Yes] [No]
```

### Persona Selection (Ambiguous Name)
```
Which persona?
[Luna Nightshade] [Luna Spark] [Cancel]
```

### Task Failure Actions
```
Task Failed: Luna comment
[Retry] [Skip] [Pause Scheduler]
```

### Post Action Quick Actions
```
Luna commented on "Cyberpunk Cities" (comment #abc123)

[View Thread] [Add Another Comment] [Vote on Post]
```

---

## Config Additions

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...      # from @BotFather
TELEGRAM_ADMIN_CHAT_ID=123456789           # your Telegram user ID
TELEGRAM_ALERTS_ENABLED=true               # master switch for proactive alerts
TELEGRAM_DIGEST_ENABLED=true               # daily digest on/off
TELEGRAM_DIGEST_HOUR=9                     # UTC hour for daily digest (0-23)
TELEGRAM_FAILURE_BATCH_WINDOW_MS=60000     # batch failures within this window
```

---

## Phase Index

| Phase | File | Focus |
|-------|------|-------|
| G.1 | [phase-g1-scaffold.md](phase-g1-scaffold.md) | Bot Scaffold + Slash Commands |
| G.2 | [phase-g2-actions.md](phase-g2-actions.md) | Action Trigger Commands |
| G.3 | [phase-g3-monitoring.md](phase-g3-monitoring.md) | Monitoring Commands |
| G.4 | [phase-g4-alerts.md](phase-g4-alerts.md) | Proactive Alerts |
| G.5 | [phase-g5-natural.md](phase-g5-natural.md) | Natural Language Interface |

## Execution Order

| Phase | Focus | Depends On | Effort |
|-------|-------|------------|--------|
| G.1 | Bot scaffold + basic commands | Persona engine Phase A (scaffold) | Small |
| G.2 | Action trigger commands | Persona engine Phase C (actions) | Medium |
| G.3 | Monitoring commands | Persona engine Phase D (scheduler) | Small |
| G.4 | Proactive alerts | G.1, Persona engine Phase D | Medium |
| G.5 | Natural language interface | G.2, Persona engine Phase B (Gemini) | Medium |

## Relationship to Admin HTTP API

The Telegram bot and the admin HTTP API overlap significantly. Strategy:

- **Keep both** — HTTP API for programmatic access (CI/CD, monitoring dashboards, future web admin panel), Telegram for daily human interaction
- **Share handlers** — both call the same underlying functions, no duplicate logic
- The HTTP API stays minimal (Phase E of persona engine plan), Telegram becomes the primary admin interface

```
telegram/commands.ts  ──┐
                        ├──► shared action handlers (actions/*.ts)
admin/routes.ts       ──┘    shared queries (db/queries.ts)
                             shared scheduler control (scheduler/*.ts)
```
