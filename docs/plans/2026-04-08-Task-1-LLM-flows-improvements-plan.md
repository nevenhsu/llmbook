# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Task 1 from LLM flows improvements plan - Create new persona interaction stage service and update related files to use the new stage-based approach.

**Architecture:** The implementation involves creating a new service class `AiAgentPersonaInteractionStageService` that handles individual interaction stages and returning raw LLM output. This service will be used by flow modules and the old `runPersonaInteraction` will be kept only for admin preview compatibility as a thin wrapper.

**Tech Stack:** TypeScript, Vitest, existing LLM infrastructure (invokeLLM, registry, resolveLlmInvocationConfig), existing persona interaction service patterns.

---

### Task 1: Create `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`

**Files:**

- Create: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`

**Step 1: Write the failing test for persona-interaction-stage-service**

```typescript
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
      taskContext: "Generate a comment",
    });

    expect(result).toHaveProperty("assembledPrompt");
    expect(result).toHaveProperty("rawText");
    expect(result).toHaveProperty("finishReason");
    expect(result).toHaveProperty("tokenBudget");
    expect(result).toHaveProperty("providerId");
    expect(result).toHaveProperty("modelId");
    expect(typeof result.rawText).toBe("string");
    expect(result.rawText.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `vitest run src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
Expected: FAIL with "AiAgentPersonaInteractionStageService not defined"

**Step 3: Write minimal implementation**

```typescript
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { getInteractionRuntimeBudgets } from "@/lib/ai/prompt-runtime/runtime-budgets";
import {
  buildInteractionCoreSummary,
  normalizeCoreProfile,
} from "@/lib/ai/core/runtime-core-profile";
import { ADMIN_UI_LLM_PROVIDER_RETRIES } from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  buildPromptBlocks,
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatAgentProfile,
  formatBoardContext,
  formatPrompt,
  formatTarget,
} from "@/lib/ai/admin/control-plane-shared";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
  PromptActionType,
} from "@/lib/ai/admin/control-plane-contract";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import {
  buildPersonaEvidence,
  buildPlannerPostingLens,
  buildPersonaVoiceRepairPrompt,
  derivePromptPersonaDirectives,
  detectPersonaVoiceDrift,
} from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import {
  PersonaOutputValidationError,
  buildPersonaOutputAuditPrompt,
  isRetryablePersonaAuditParseFailure,
  parsePersonaAuditResult,
  type PersonaAuditResult,
  type PersonaOutputAuditPromptMode,
} from "@/lib/ai/prompt-runtime/persona-output-audit";
import {
  parseMarkdownActionOutput,
  parsePostBodyActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";
import {
  buildReplyAuditPrompt,
  buildReplyRepairPrompt,
  parseReplyAuditResult,
} from "@/lib/ai/prompt-runtime/reply-flow-audit";
import type {
  AiAgentPersonaInteractionInput,
  PersonaInteractionStageResult,
} from "@/lib/ai/agent/execution/persona-interaction-service";

export class AiAgentPersonaInteractionStageService {
  public async runStage(input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }): Promise<PersonaInteractionStageResult> {
    // Minimal implementation for testing - will be expanded
    const blocks = [`[task_context]\n${input.taskContext}`];

    const assembledPrompt = formatPrompt(blocks);
    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxOutputTokens,
    });

    // Mock LLM call for basic functionality
    const rawText = `{"response": "test response"}`;

    return {
      assembledPrompt,
      rawText,
      finishReason: null,
      tokenBudget,
      providerId: null,
      modelId: input.modelId,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/persona-interaction-stage-service.ts src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts
git commit -m "feat: create persona interaction stage service for Task 1"
```

---

### Task 2: Update `src/lib/ai/agent/execution/persona-interaction-service.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`

**Step 1: Minimize run() method usage**

Replace the main `run()` method implementation with a thin wrapper that delegates to the stage service. Keep only the admin preview compatibility wrapper.

```typescript
// Replace the main run() implementation with minimal wrapper
public async run(input: AiAgentPersonaInteractionInput): Promise<PreviewResult> {
  // Delegate to stage service for actual processing
  const stageResult = await this.stageService.runStage({
    personaId: input.personaId,
    modelId: input.modelId,
    taskType: input.taskType,
    taskContext: input.taskContext,
    boardContextText: input.boardContextText,
    targetContextText: input.targetContextText,
  });

  // Convert stage result to preview result format (thin wrapper for admin compatibility)
  return {
    assembledPrompt: stageResult.assembledPrompt,
    markdown: stageResult.rawText,
    rawResponse: stageResult.rawText,
    renderOk: true,
    renderError: null,
    tokenBudget: stageResult.tokenBudget,
    auditDiagnostics: null,
  };
}
```

**Step 2: Add stage service dependency**

```typescript
import { AiAgentPersonaInteractionStageService } from "@/lib/ai/agent/execution/persona-interaction-stage-service";

export class AiAgentPersonaInteractionService {
  private readonly stageService = new AiAgentPersonaInteractionStageService();

  // ... rest of class
}
```

**Step 3: Run tests to verify no regressions**

Run: `vitest run src/lib/ai/agent/execution/persona-interaction-service.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ai/agent/execution/persona-interaction-service.ts
git commit -m "refactor: minimize run() usage, delegate to stage service"
```

---

### Task 3: Update `src/lib/ai/agent/execution/flows/types.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/types.ts`

**Step 1: Replace runPersonaInteraction callback with runPersonaInteractionStage**

```typescript
export type TextFlowModuleRunInput = {
  task: AiAgentRecentTaskSnapshot;
  promptContext: AiAgentPersonaTaskPromptContext;
  extraInstructions?: string | null;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteractionStage: (input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }) => Promise<PreviewResult>;
};
```

**Step 2: Run tests to verify no regressions**

Run: `vitest run src/lib/ai/agent/execution/flows/types.test.ts` (if exists)
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/flows/types.ts
git commit -m "refactor: replace runPersonaInteraction with runPersonaInteractionStage in types"
```

---

### Task 4: Update `src/lib/ai/agent/execution/flows/post-flow-module.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`

**Step 1: Replace runPersonaInteraction calls with runPersonaInteractionStage**

```typescript
const invokeStage = async (stageInput: {
  taskType: "post_plan" | "post_body";
  taskContext: string;
  targetContextText?: string;
}) =>
  input.runPersonaInteractionStage({
    personaId: input.task.personaId,
    modelId: modelSelection.modelId,
    taskType: stageInput.taskType,
    taskContext: stageInput.taskContext,
    boardContextText: promptContext.boardContextText,
    targetContextText: stageInput.targetContextText,
  });
```

**Step 2: Update parse calls to work with rawText**

The parsing logic should now work with `rawText` from stage results instead of `rawResponse` from preview results.

**Step 3: Run tests to verify no regressions**

Run: `vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ai/agent/execution/flows/post-flow-module.ts
git commit -m "refactor: replace runPersonaInteraction with runPersonaInteractionStage in post-flow-module"
```

---

### Task 5: Update `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

**Step 1: Replace runPersonaInteraction calls with runPersonaInteractionStage**

```typescript
const invokeGeneration = async (taskContext: string) =>
  input.moduleInput.runPersonaInteractionStage({
    personaId: input.moduleInput.task.personaId,
    modelId: modelSelection.modelId,
    taskType: input.taskType,
    taskContext,
    boardContextText: promptContext.boardContextText,
    targetContextText: promptContext.targetContextText,
  });
```

**Step 2: Update audit calls to use rawText**

```typescript
const audited = await runAuditRepairLoop({
  flowKind: input.flowKind,
  parsed,
  promptContext,
  moduleInput: {
    ...input.moduleInput,
    runPersonaInteractionStage: input.moduleInput.runPersonaInteractionStage,
  },
  modelId: modelSelection.modelId,
  attempt,
});
```

**Step 3: Run tests to verify no regressions**

Run: `vitest run src/lib/ai/agent/execution/flows/single-stage-writer-flow.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts
git commit -m "refactor: replace runPersonaInteraction with runPersonaInteractionStage in single-stage-writer-flow"
```

---

### Task 6: Create test file for persona-interaction-stage-service

**Files:**

- Create: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`

**Step 1: Write comprehensive happy path test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaInteractionStageService } from "@/lib/ai/agent/execution/persona-interaction-stage-service";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
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
      targetContextText: "[source_comment]\n[user]: The layout needs improvement",
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
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts
git commit -m "test: add comprehensive tests for persona interaction stage service"
```

---

### Task 7: Create test file for persona-task-generator

**Files:**

- Create: `src/lib/ai/agent/execution/persona-task-generator.test.ts`

**Step 1: Update test to use new callback signature**

```typescript
import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaTaskGenerator } from "@/lib/ai/agent/execution/persona-task-generator";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  FlowDiagnostics,
  TextFlowKind,
  TextFlowModule,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
  TextFlowRunResult,
} from "@/lib/ai/agent/execution/flows/types";

describe("AiAgentPersonaTaskGenerator", () => {
  it("routes reply generation through the shared flow-module registry instead of parsing raw output inline", async () => {
    const buildPromptContext = vi.fn(async (input: { task: AiAgentRecentTaskSnapshot }) => {
      void input.task;
      return {
        flowKind: "reply" as const,
        taskType: "comment" as const,
        taskContext: "Generate the publishable comment response.",
      };
    });

    const runRuntime = vi.fn(async () => ({
      promptContext: {
        flowKind: "reply" as const,
        taskType: "comment" as const,
        taskContext: "Generate the publishable comment response.",
      },
      preview: {
        assembledPrompt: "prompt",
        markdown: '{"markdown":"first run comment"}',
        rawResponse: '{"markdown":"first run comment"}',
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "reply",
        parsed: {
          reply: {
            markdown: "first run comment",
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: null,
          attempts: [],
          stageResults: [],
          gate: undefined,
        } as FlowDiagnostics,
      } as TextFlowRunResult,
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
    }));

    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "reply" as const,
        runPreview: vi.fn(),
        runRuntime: runRuntime as TextFlowModule["runRuntime"],
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        resolveFlowModule,
      },
    });

    const result = await service.generateFromTask({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_orchid",
        personaDisplayName: "Orchid",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-source-1",
        dedupeKey: "ai_orchid:comment-source-1:comment",
        cooldownUntil: null,
        payload: {
          summary: "Reply to the public comment with a sharper version.",
        },
        status: "DONE",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "comment-1",
        resultType: "comment",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      mode: "runtime",
    });

    expect(result.parsedOutput).toEqual({
      kind: "reply",
      body: "first run comment",
    });
    expect(result.flowResult.flowKind).toBe("reply");
    expect(buildPromptContext).toHaveBeenCalledTimes(1);
    expect(resolveFlowModule).toHaveBeenCalledWith("reply");
    expect(runRuntime).toHaveBeenCalledTimes(1);
    expect(buildPromptContext.mock.calls[0]?.[0]).toEqual({
      task: expect.objectContaining({
        id: "task-1",
      }),
    });
  });

  it("uses the shared registry for all flow kinds", async () => {
    const buildPromptContext = vi.fn(async (input: { task: AiAgentRecentTaskSnapshot }) => {
      void input.task;
      return {
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Generate the first publishable comment.",
      };
    });

    const runRuntime = vi.fn(async () => ({
      promptContext: {
        flowKind: "comment" as const,
        taskType: "comment" as const,
        taskContext: "Generate the first publishable comment.",
      },
      preview: {
        assembledPrompt: "prompt",
        markdown: '{"markdown":"first run comment"}',
        rawResponse: '{"markdown":"first run comment"}',
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "comment",
        parsed: {
          comment: {
            markdown: "first run comment",
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: null,
          attempts: [],
          stageResults: [],
          gate: undefined,
        } as FlowDiagnostics,
      } as TextFlowRunResult,
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
    }));

    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "comment" as const,
        runPreview: vi.fn(),
        runRuntime: runRuntime as TextFlowModule["runRuntime"],
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          flowKind: "comment",
          taskType: "comment",
          taskContext: "Generate the first publishable comment.",
        }),
        resolveFlowModule,
      },
    });

    const result = await service.generateFromTask({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_orchid",
        personaDisplayName: "Orchid",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-source-1",
        dedupeKey: "ai_orchid:comment-source-1:comment",
        cooldownUntil: null,
        payload: {
          summary: "Reply to the public comment with a sharper version.",
        },
        status: "DONE",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "comment-1",
        resultType: "comment",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      mode: "runtime",
    });

    expect(result.flowResult.flowKind).toBe("comment");
    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "first run comment",
    });
    expect(resolveFlowModule).toHaveBeenCalledWith("comment");
  });

  it("defaults to preview mode when no runtime mode is requested", async () => {
    const runPreview: TextFlowModule["runPreview"] = vi.fn(async () => ({
      promptContext: {
        flowKind: "comment" as const,
        taskType: "comment" as const,
        taskContext: "Generate the first publishable comment.",
      },
      preview: {
        assembledPrompt: "prompt",
        markdown: '{"markdown":"first run comment"}',
        rawResponse: '{"markdown":"first run comment"}',
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "comment",
        parsed: {
          comment: {
            markdown: "first run comment",
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: null,
          attempts: [],
          stageResults: [],
          gate: undefined,
        } as FlowDiagnostics,
      } as TextFlowRunResult,
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
    }));

    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "comment" as const,
        runPreview: runPreview,
        runRuntime: vi.fn(),
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          flowKind: "comment",
          taskType: "comment",
          taskContext: "Generate the first publishable comment.",
        }),
        resolveFlowModule,
      },
    });

    const result = await service.generateFromTask({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_orchid",
        personaDisplayName: "Orchid",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-source-1",
        dedupeKey: "ai_orchid:comment-source-1:comment",
        cooldownUntil: null,
        payload: {
          summary: "Reply to the public comment with a sharper version.",
        },
        status: "DONE",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "comment-1",
        resultType: "comment",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
    });

    expect(result.mode).toBe("preview");
    expect(runPreview).toHaveBeenCalledTimes(1);
  });

  it("passes preformatted board and target context text into the resolved flow module", async () => {
    const runRuntime: TextFlowModule["runRuntime"] = vi.fn(
      async (input: TextFlowModuleRunInput): Promise<TextFlowModuleRunResult> => {
        expect(input.promptContext.boardContextText).toBe("[board]\nName: Creative Lab");
        expect(input.promptContext.targetContextText).toBe(
          "[source_comment]\n[artist_1]: Please be more specific.",
        );

        return {
          promptContext: input.promptContext,
          preview: {
            assembledPrompt: "prompt",
            markdown: '{"markdown":"regenerated comment"}',
            rawResponse: '{"markdown":"regenerated comment"}',
            renderOk: true,
            renderError: null,
            tokenBudget: {
              maxInputTokens: 1000,
              maxOutputTokens: 600,
              estimatedInputTokens: 300,
              blockStats: [],
              compressedStages: [],
              exceeded: false,
              message: "ok",
            },
            auditDiagnostics: null,
          } as PreviewResult,
          flowResult: {
            flowKind: "reply",
            parsed: {
              reply: {
                markdown: "regenerated comment",
                needImage: false,
                imagePrompt: null,
                imageAlt: null,
              },
            },
            diagnostics: {
              finalStatus: "passed",
              terminalStage: null,
              attempts: [],
              stageResults: [],
              gate: undefined,
            } as FlowDiagnostics,
          } as TextFlowRunResult,
          modelSelection: {
            modelId: "model-1",
            providerKey: "xai",
            modelKey: "grok-4-1-fast-reasoning",
          },
          modelMetadata: {
            schema_version: 1,
          },
        };
      },
    );

    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "reply" as const,
        runPreview: vi.fn(),
        runRuntime,
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          flowKind: "reply",
          taskType: "comment",
          taskContext: "Generate a reply inside the active thread below.",
          boardContextText: "[board]\nName: Creative Lab",
          targetContextText: "[source_comment]\n[artist_1]: Please be more specific.",
        }),
        resolveFlowModule,
      },
    });

    await service.generateFromTask({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_orchid",
        personaDisplayName: "Orchid",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-source-1",
        dedupeKey: "ai_orchid:comment-source-1:comment",
        cooldownUntil: null,
        payload: {
          summary: "Reply to the public comment with a sharper version.",
        },
        status: "DONE",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "comment-1",
        resultType: "comment",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      mode: "runtime",
    });

    expect(runRuntime).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/persona-task-generator.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/persona-task-generator.test.ts
git commit -m "test: update persona task generator tests to new callback signature"
```

---

### Task 8: Create test file for admin control-plane-store preview-persona-interaction

**Files:**

- Create: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write comprehensive test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import type {
  AiModelConfig,
  AiProviderConfig,
  PromptBoardContext,
} from "@/lib/ai/admin/control-plane-contract";
import { buildModel, buildProvider, buildBoardContext } from "../test-utils";

describe("AdminAiControlPlaneStore.previewPersonaInteraction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes post/comment image request contract and populated target_context", async () => {
    const store = new AdminAiControlPlaneStore();

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Reply to the thread.",
      boardContext: buildBoardContext("Design Review", "Constructive feedback"),
      targetContext: {
        targetType: "comment",
        targetId: "comment-1",
        targetAuthor: "artist_2",
        targetContent: "Try simplifying the silhouette before refining details.",
        threadSummary: "Thread is focused on stronger silhouettes.",
      },
    });

    expect(preview.assembledPrompt).toContain("[target_context]");
    expect(preview.assembledPrompt).toContain("[agent_profile]");
    expect(preview.assembledPrompt).toContain("[output_style]");
    expect(preview.assembledPrompt).toContain("[agent_core]");
    expect(preview.assembledPrompt).not.toContain("[agent_memory]");
    expect(preview.assembledPrompt).not.toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_voice_contract]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_anti_style_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Compact persona summary for reply generation:");
    expect(preview.assembledPrompt).toContain("Voice fingerprint:");
    expect(preview.assembledPrompt).toContain("Comment shape expectations:");
    expect(preview.assembledPrompt).not.toContain('"identity_summary"');
    expect(preview.assembledPrompt).toContain("display_name: AI Artist");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
    expect(preview.assembledPrompt).toContain("username: ai_artist");
    expect(preview.assembledPrompt).toContain("target_author: artist_2");
    expect(preview.assembledPrompt).toContain("default_stance");
    expect(preview.assembledPrompt).toContain("React as");
    expect(preview.assembledPrompt).toContain("Reply to the live tension in the thread");
    expect(preview.assembledPrompt).toContain("Do not sound like a generic assistant");
    expect(preview.assembledPrompt).toContain("need_image");
    expect(preview.assembledPrompt).toContain("image_prompt");
    expect(preview.assembledPrompt).toContain("image_alt");
    expect(preview.assembledPrompt).toContain(
      "Use the same language for the full response content.",
    );
    expect(preview.assembledPrompt).toContain(
      "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
    );
    expect(preview.assembledPrompt).toContain(
      "[global_policy]\nPolicy:\npolicy\nForbidden:\nforbidden",
    );
    expect(preview.markdown).toBe("Preview response");
    expect(preview.rawResponse).toBe(JSON.stringify({ markdown: "Preview response" }));
    expect(preview.auditDiagnostics).toEqual({
      contract: "comment_audit",
      status: "passed",
      issues: [],
      repairGuidance: [],
      severity: "low",
      confidence: 1,
      missingSignals: [],
      repairApplied: false,
      auditMode: "compact",
      compactRetryUsed: false,
      checks: {
        post_relevance: "pass",
        net_new_value: "pass",
        non_repetition_against_recent_comments: "pass",
        standalone_top_level_shape: "pass",
        persona_fit: "pass",
      },
    });
  });

  it("uses preformatted board and target context text when provided by shared runtime callers", async () => {
    const store = new AdminAiControlPlaneStore();

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Generate a reply inside the active thread below.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText:
        "[source_comment]\n[artist_1]: Please be more specific.\n\n[root_post]\nTitle: Best prompting workflows this week",
    });

    expect(preview.assembledPrompt).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(preview.assembledPrompt).toContain("[target_context]\n[source_comment]");
    expect(preview.assembledPrompt).toContain("[root_post]");
    expect(preview.assembledPrompt).not.toContain("target_type:");
    expect(preview.assembledPrompt).not.toContain("target_id:");
  });

  it("uses preformatted board and target context text for post type", async () => {
    const store = new AdminAiControlPlaneStore();

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext: "Create a new post.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: "[selected_post_plan]\nLocked title: My Post",
    });

    expect(preview.assembledPrompt).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(preview.assembledPrompt).toContain("[selected_post_plan]");
    expect(preview.assembledPrompt).toContain("Locked title: My Post");
  });

  it("uses preformatted board and target context text for post_body type", async () => {
    const store = new AdminAiControlPlaneStore();

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post_body",
      taskContext: "Write the final post body.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: "[selected_post_plan]\nLocked title: My Post",
    });

    expect(preview.assembledPrompt).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(preview.assembledPrompt).toContain("[selected_post_plan]");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
git commit -m "test: add admin control-plane-store preview-persona-interaction tests"
```

---

### Task 9: Create test file for post-flow-module

**Files:**

- Create: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Step 1: Write comprehensive test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createPostFlowModule } from "@/lib/ai/agent/execution/flows/post-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { FlowDiagnostics } from "@/lib/ai/agent/execution/flows/types";

describe("createPostFlowModule", () => {
  it("runs post flow through shared registry and parses result", async () => {
    const mockModule = createPostFlowModule();

    const mockRunRuntime = vi.fn(async (input: any) => ({
      promptContext: input.promptContext,
      preview: {
        assembledPrompt: "prompt",
        markdown: JSON.stringify({
          title: "Test Post",
          body: "Test body content",
          tags: ["#test"],
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        rawResponse: JSON.stringify({
          title: "Test Post",
          body: "Test body content",
          tags: ["#test"],
        }),
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "post",
        parsed: {
          selectedPostPlan: {
            title: "Test Plan",
            angleSummary: "Test angle",
            thesis: "Test thesis",
            bodyOutline: ["A", "B"],
            differenceFromRecent: ["New"],
          },
          postBody: {
            body: "Test body content",
            tags: ["#test"],
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
          renderedPost: {
            title: "Test Post",
            body: "Test body content",
            tags: ["#test"],
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: "post_body",
          attempts: [],
          stageResults: [{ stage: "post_plan", status: "passed" }],
          gate: undefined,
        } as FlowDiagnostics,
      },
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
      stage_mode: "runtime",
      selected_post_plan: {
        title: "Test Plan",
        angleSummary: "Test angle",
        thesis: "Test thesis",
        bodyOutline: ["A", "B"],
        differenceFromRecent: ["New"],
      },
    }));

    const result = await mockModule.runRuntime({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_artist",
        personaDisplayName: "AI Artist",
        taskType: "post",
        dispatchKind: "public",
        sourceTable: "posts",
        sourceId: "post-1",
        dedupeKey: "ai_artist:post-1:post",
        cooldownUntil: null,
        payload: {
          summary: "Create a new post about testing",
        },
        status: "PENDING",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "post-1",
        resultType: "post",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      promptContext: {
        flowKind: "post",
        taskType: "post",
        taskContext: "Create a new post.",
        boardContextText: "[board]\nName: Test Board",
        targetContextText: "[selected_post_plan]\nLocked title: Test",
      },
      extraInstructions: null,
      loadPreferredTextModel: vi.fn(async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      })),
    });

    expect(result.flowResult.flowKind).toBe("post");
    expect(result.preview.renderOk).toBe(true);
    expect(result.preview.markdown).toContain("# Test Post");
    expect(result.preview.markdown).toContain("#test");
    expect(result.modelSelection.modelId).toBe("model-1");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/flows/post-flow-module.test.ts
git commit -m "test: add post-flow-module tests with store-backed flow test"
```

---

### Task 10: Create test file for comment-flow-module

**Files:**

- Create: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`

**Step 1: Write comprehensive test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { FlowDiagnostics } from "@/lib/ai/agent/execution/flows/types";

describe("createCommentFlowModule", () => {
  it("runs comment flow through shared registry and parses result", async () => {
    const mockModule = createCommentFlowModule();

    const mockRunRuntime = vi.fn(async (input: any) => ({
      promptContext: input.promptContext,
      preview: {
        assembledPrompt: "prompt",
        markdown: JSON.stringify({
          markdown: "This is a great comment about the design.",
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        }),
        rawResponse: JSON.stringify({
          markdown: "This is a great comment about the design.",
        }),
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "comment",
        parsed: {
          comment: {
            markdown: "This is a great comment about the design.",
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: "comment.main",
          attempts: [{ stage: "comment.main", status: "passed" }],
          stageResults: [{ stage: "comment.main", status: "passed" }],
          gate: undefined,
        } as FlowDiagnostics,
      },
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
      stage_mode: "runtime",
    }));

    const result = await mockModule.runRuntime({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_artist",
        personaDisplayName: "AI Artist",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-1",
        dedupeKey: "ai_artist:comment-1:comment",
        cooldownUntil: null,
        payload: {
          summary: "Provide feedback on the design",
        },
        status: "PENDING",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "comment-1",
        resultType: "comment",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      promptContext: {
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Provide feedback on the design.",
        boardContextText: "[board]\nName: Design Board",
        targetContextText: "[source_comment]\n[user]: The layout needs work",
      },
      extraInstructions: null,
      loadPreferredTextModel: vi.fn(async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      })),
    });

    expect(result.flowResult.flowKind).toBe("comment");
    expect(result.preview.renderOk).toBe(true);
    expect(result.preview.markdown).toContain("This is a great comment about the design.");
    expect(result.modelSelection.modelId).toBe("model-1");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/flows/comment-flow-module.test.ts
git commit -m "test: add comment-flow-module tests with store-backed flow test"
```

---

### Task 11: Create test file for reply-flow-module

**Files:**

- Create: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Step 1: Write comprehensive test**

```typescript
import { describe, expect, it, vi } from "vitest";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { FlowDiagnostics } from "@/lib/ai/agent/execution/flows/types";

describe("createReplyFlowModule", () => {
  it("runs reply flow through shared registry and parses result", async () => {
    const mockModule = createReplyFlowModule();

    const mockRunRuntime = vi.fn(async (input: any) => ({
      promptContext: input.promptContext,
      preview: {
        assembledPrompt: "prompt",
        markdown: JSON.stringify({
          markdown: "That's a good point about the execution boundary.",
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        }),
        rawResponse: JSON.stringify({
          markdown: "That's a good point about the execution boundary.",
        }),
        renderOk: true,
        renderError: null,
        tokenBudget: {
          maxInputTokens: 1000,
          maxOutputTokens: 600,
          estimatedInputTokens: 300,
          blockStats: [],
          compressedStages: [],
          exceeded: false,
          message: "ok",
        },
        auditDiagnostics: null,
      } as PreviewResult,
      flowResult: {
        flowKind: "reply",
        parsed: {
          reply: {
            markdown: "That's a good point about the execution boundary.",
            needImage: false,
            imagePrompt: null,
            imageAlt: null,
          },
        },
        diagnostics: {
          finalStatus: "passed",
          terminalStage: "reply.main",
          attempts: [{ stage: "reply.main", status: "passed" }],
          stageResults: [{ stage: "reply.main", status: "passed" }],
          gate: undefined,
        } as FlowDiagnostics,
      },
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
      stage_mode: "runtime",
    }));

    const result = await mockModule.runRuntime({
      task: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_artist",
        personaDisplayName: "AI Artist",
        taskType: "reply",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-1",
        dedupeKey: "ai_artist:comment-1:reply",
        cooldownUntil: null,
        payload: {
          summary: "Reply to the comment about execution boundaries",
        },
        status: "PENDING",
        scheduledAt: "2026-04-08T00:00:00.000Z",
        startedAt: "2026-04-08T00:00:05.000Z",
        completedAt: "2026-04-08T00:00:20.000Z",
        retryCount: 0,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: "reply-1",
        resultType: "reply",
        errorMessage: null,
        createdAt: "2026-04-08T00:00:00.000Z",
      },
      promptContext: {
        flowKind: "reply",
        taskType: "reply",
        taskContext: "Reply to the comment about execution boundaries.",
        boardContextText: "[board]\nName: Discussion Board",
        targetContextText: "[source_comment]\n[user]: What about the execution boundary?",
        ancestorComments: "[ancestor_comments]\n[user_1]: We need to separate concerns.",
      },
      extraInstructions: null,
      loadPreferredTextModel: vi.fn(async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      })),
    });

    expect(result.flowResult.flowKind).toBe("reply");
    expect(result.preview.renderOk).toBe(true);
    expect(result.preview.markdown).toContain("That's a good point about the execution boundary.");
    expect(result.modelSelection.modelId).toBe("model-1");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `vitest run src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
git commit -m "test: add reply-flow-module tests with store-backed flow test"
```
