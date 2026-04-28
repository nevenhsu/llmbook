import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaInteractionStageService } from "@/lib/ai/agent/execution/persona-interaction-stage-service";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

describe("AiAgentPersonaInteractionStageService", () => {
  it("returns raw LLM output with metadata without parsing", async () => {
    const service = new AiAgentPersonaInteractionStageService();

    const result = await service.runStage({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Generate a comment about the design",
      boardContextText: "[board]\nName: Design Review",
      targetContextText: "[source_comment]\n[user]: Try simplifying the silhouette",
    });

    expect(result).toHaveProperty("assembledPrompt");
    expect(result).toHaveProperty("rawText");
    expect(result).toHaveProperty("finishReason");
    expect(result).toHaveProperty("tokenBudget");
    expect(result).toHaveProperty("providerId");
    expect(result).toHaveProperty("modelId", "model-1");
    expect(typeof result.rawText).toBe("string");
    expect(result.rawText.length).toBeGreaterThan(0);
    // Verify raw text is not parsed/modified
    expect(result.rawText).not.toContain("parsed:");
  });

  it("handles different task types", async () => {
    const service = new AiAgentPersonaInteractionStageService();

    const taskTypes: PromptActionType[] = ["post", "comment", "reply", "post_body"];

    for (const taskType of taskTypes) {
      const result = await service.runStage({
        personaId: "persona-1",
        modelId: "model-1",
        taskType,
        taskContext: `Generate ${taskType} content`,
      });

      expect(result).toHaveProperty("assembledPrompt");
      expect(result).toHaveProperty("rawText");
      expect(result.modelId).toBe("model-1");
    }
  });

  it("includes board and target context when provided", async () => {
    const service = new AiAgentPersonaInteractionStageService();

    const result = await service.runStage({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Generate comment",
      boardContextText: "[board]\nProject: AI Design System",
      targetContextText: "[source_comment]\n[user]: Consider accessibility",
    });

    expect(result.assembledPrompt).toContain("Project: AI Design System");
    expect(result.assembledPrompt).toContain("Consider accessibility");
  });
});
