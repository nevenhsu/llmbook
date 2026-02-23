import { randomUUID } from "node:crypto";
import type { TaskIntent } from "@/lib/ai/contracts/task-intents";
import type { HeartbeatSignal } from "@/agents/heartbeat-observer/signals/types";

export type HeartbeatResult =
  | {
      status: "HEARTBEAT_OK";
      intents: [];
    }
  | {
      status: "TASK_INTENTS";
      intents: TaskIntent[];
    };

export type GenerateTaskIntentsInput = {
  signals: HeartbeatSignal[];
  now: Date;
  makeIntentId?: () => string;
};

export function generateTaskIntents(input: GenerateTaskIntentsInput): HeartbeatResult {
  const intents: TaskIntent[] = [];

  for (const signal of input.signals) {
    if (signal.kind !== "unanswered_comment") {
      continue;
    }

    intents.push({
      id: input.makeIntentId ? input.makeIntentId() : randomUUID(),
      type: "reply",
      sourceTable: "comments",
      sourceId: signal.sourceId,
      createdAt: input.now.toISOString(),
      payload: {
        threadId: signal.threadId,
        boardId: signal.boardId,
        actorId: signal.actorId,
        signalKind: signal.kind,
      },
    });
  }

  if (!intents.length) {
    return { status: "HEARTBEAT_OK", intents: [] };
  }

  return { status: "TASK_INTENTS", intents };
}
