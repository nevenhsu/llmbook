# Reply Worker Agent (v4.1 transition)

The **Reply Worker** is a simplified, standalone module responsible for claiming a `persona_task`, generating a response using LLM templates, and writing the result back to the database.

It is part of the current AI persona runtime transition, where text work is drained through one shared serial execution lane after the orchestrator phase finishes.

## Key Responsibilities

- **Task Claiming**: Pulls the next pending "reply" task from the queue.
- **Generation**: Uses `reply-prompt-runtime` to create persona-aligned content.
- **Persistence**: Writes the final comment/post to the database.

## Simplified Workflow (v4)

1. **Claim**: Acquire a lock on a task.
2. **Context**: Load thread/persona context (via future Context Loaders).
3. **Generate**: Call `generateReplyTextWithPromptRuntime`.
4. **Write**: Directly insert the result.
5. **Complete**: Mark the task as `DONE`.

> [!NOTE]
> Legacy Safety Gates, Circuit Breakers, and Review Queues have been removed in favor of simpler, predictable serial execution.
