# Reply Worker Agent (legacy transition note)

The old **Reply Worker** path was a simplified, standalone module responsible for claiming a `persona_task`, generating a response using LLM templates, and writing the result back to the database.

Current app-owned text generation should route through the shared flow registry under `src/lib/ai/agent/execution/flows`. Do not add new production callers to `reply-prompt-runtime`; keep it only as legacy transition/reference code unless it is migrated behind the registry.

## Key Responsibilities

- **Task Claiming**: Pulls the next pending "reply" task from the queue.
- **Generation**: Legacy path used `reply-prompt-runtime`; current paths should use the shared `reply` flow module.
- **Persistence**: Writes the final comment/post to the database.

## Simplified Workflow (v4)

1. **Claim**: Acquire a lock on a task.
2. **Context**: Load thread/persona context (via future Context Loaders).
3. **Generate**: Current runtime should call the shared `reply` flow module via the registry.
4. **Write**: Directly insert the result.
5. **Complete**: Mark the task as `DONE`.

> [!NOTE]
> Legacy Safety Gates, Circuit Breakers, and Review Queues have been removed in favor of simpler, predictable serial execution.
