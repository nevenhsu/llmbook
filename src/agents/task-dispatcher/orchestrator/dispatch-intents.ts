import { randomUUID } from "node:crypto";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type {
  DecisionReasonCode,
  PersonaProfile,
  TaskIntent,
} from "@/lib/ai/contracts/task-intents";
import {
  isReplyAllowed,
  type DispatcherPolicy,
} from "@/agents/task-dispatcher/policy/reply-only-policy";

export type DispatchDecision = {
  intentId: string;
  taskId?: string;
  personaId?: string;
  taskType?: string;
  reasons: DecisionReasonCode[];
  dispatched: boolean;
};

export type DispatchIntentsInput = {
  intents: TaskIntent[];
  personas: PersonaProfile[];
  policy: DispatcherPolicy;
  now: Date;
  createTask: (task: QueueTask) => Promise<void>;
  makeTaskId?: () => string;
  precheck?: (input: {
    intent: TaskIntent;
    persona: PersonaProfile;
    now: Date;
  }) => Promise<{ allowed: boolean; reasons: DecisionReasonCode[] }>;
};

function buildReplyTask(params: {
  taskId: string;
  personaId: string;
  intent: TaskIntent;
  now: Date;
}): QueueTask {
  return {
    id: params.taskId,
    personaId: params.personaId,
    taskType: "reply",
    payload: {
      ...params.intent.payload,
      sourceIntentId: params.intent.id,
      sourceTable: params.intent.sourceTable,
      sourceId: params.intent.sourceId,
    },
    status: "PENDING",
    scheduledAt: new Date(params.now),
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(params.now),
  };
}

export async function dispatchIntents(input: DispatchIntentsInput): Promise<DispatchDecision[]> {
  const activePersonas = input.personas.filter((persona) => persona.status === "active");
  const decisions: DispatchDecision[] = [];

  for (const intent of input.intents) {
    const reasons: DecisionReasonCode[] = [];

    if (intent.type !== "reply") {
      reasons.push("INTENT_TYPE_BLOCKED");
      decisions.push({ intentId: intent.id, dispatched: false, reasons });
      continue;
    }

    if (!isReplyAllowed(input.policy)) {
      reasons.push("POLICY_DISABLED");
      decisions.push({ intentId: intent.id, dispatched: false, reasons });
      continue;
    }

    if (!activePersonas.length) {
      reasons.push("NO_ACTIVE_PERSONA");
      decisions.push({ intentId: intent.id, dispatched: false, reasons });
      continue;
    }

    const selected = activePersonas[0];
    if (!selected) {
      reasons.push("NO_ACTIVE_PERSONA");
      decisions.push({ intentId: intent.id, dispatched: false, reasons });
      continue;
    }

    reasons.push("ACTIVE_OK", "SELECTED_DEFAULT");

    if (input.precheck) {
      const precheck = await input.precheck({
        intent,
        persona: selected,
        now: input.now,
      });
      if (!precheck.allowed) {
        reasons.push(...precheck.reasons);
        decisions.push({ intentId: intent.id, dispatched: false, reasons });
        continue;
      }
    }

    const taskId = input.makeTaskId ? input.makeTaskId() : randomUUID();
    const task = buildReplyTask({
      taskId,
      personaId: selected.id,
      intent,
      now: input.now,
    });

    await input.createTask(task);

    decisions.push({
      intentId: intent.id,
      taskId,
      personaId: selected.id,
      taskType: task.taskType,
      reasons,
      dispatched: true,
    });
  }

  return decisions;
}
