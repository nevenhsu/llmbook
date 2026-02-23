import { describe, it, expect } from "vitest";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import type { TaskIntent, PersonaProfile } from "@/lib/ai/contracts/task-intents";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";

function buildIntent(overrides: Partial<TaskIntent> = {}): TaskIntent {
  return {
    id: overrides.id ?? "intent-1",
    type: overrides.type ?? "reply",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-1",
    createdAt: overrides.createdAt ?? "2026-02-23T00:00:00.000Z",
    payload: overrides.payload ?? { threadId: "thread-1" },
  };
}

function buildPersona(overrides: Partial<PersonaProfile> = {}): PersonaProfile {
  return {
    id: overrides.id ?? "persona-1",
    status: overrides.status ?? "active",
    specialties: overrides.specialties,
  };
}

describe("dispatchIntents", () => {
  it("dispatches reply intents only to active personas", async () => {
    const created: QueueTask[] = [];

    const decisions = await dispatchIntents({
      intents: [buildIntent()],
      personas: [
        buildPersona({ id: "active-1", status: "active" }),
        buildPersona({ id: "inactive", status: "inactive" }),
      ],
      policy: { replyEnabled: true },
      now: new Date("2026-02-23T00:00:00.000Z"),
      createTask: async (task) => {
        created.push(task);
      },
      makeTaskId: () => "task-1",
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.personaId).toBe("active-1");
    expect(created[0]?.taskType).toBe("reply");
    expect(decisions[0]?.dispatched).toBe(true);
    expect(decisions[0]?.reasons).toContain("ACTIVE_OK");
  });

  it("does not dispatch when policy is disabled", async () => {
    const created: QueueTask[] = [];

    const decisions = await dispatchIntents({
      intents: [buildIntent()],
      personas: [buildPersona({ id: "active-1" })],
      policy: { replyEnabled: false },
      now: new Date("2026-02-23T00:00:00.000Z"),
      createTask: async (task) => {
        created.push(task);
      },
    });

    expect(created).toHaveLength(0);
    expect(decisions[0]?.dispatched).toBe(false);
    expect(decisions[0]?.reasons).toEqual(["POLICY_DISABLED"]);
  });

  it("blocks non-reply intents in reply-only phase", async () => {
    const created: QueueTask[] = [];

    const decisions = await dispatchIntents({
      intents: [buildIntent({ type: "vote" })],
      personas: [buildPersona({ id: "active-1" })],
      policy: { replyEnabled: true },
      now: new Date("2026-02-23T00:00:00.000Z"),
      createTask: async (task) => {
        created.push(task);
      },
    });

    expect(created).toHaveLength(0);
    expect(decisions[0]?.dispatched).toBe(false);
    expect(decisions[0]?.reasons).toEqual(["INTENT_TYPE_BLOCKED"]);
  });
});
