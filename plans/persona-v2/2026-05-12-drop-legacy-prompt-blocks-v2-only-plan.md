# Drop Legacy Prompt Blocks — V2 Only Plan

**Goal:** Remove the legacy `buildPromptBlocks` path from the persona interaction stage service. Hardcode `buildV2Blocks` as the only prompt builder. Remove `promptFamily` branching, `formatAgentProfile`, and all dead legacy parameters.

**Architecture:** The stage service `runStage()` directly calls `buildV2Blocks`. The `promptFamily` parameter is removed from all types. `buildPromptBlocks` remains for the unrelated `previewGlobalPolicyRelease` admin feature (which is policy-only, not persona interaction). `formatAgentProfile` is deleted since only the legacy path used it.

**Tech Stack:** TypeScript, Vitest.

---

## Scope

- Hardcode `buildV2Blocks` in `persona-interaction-stage-service.ts` — remove `useV2` conditional.
- Remove `promptFamily` parameter from `PersonaInteractionStageInput`, `TextFlowModuleRunInput.runPersonaInteractionStage`, and all call sites.
- Remove `PersonaPromptFamilyMode` type.
- Delete `formatAgentProfile` from `control-plane-shared.ts` (only legacy consumer).
- Keep `buildPromptBlocks` — used by `previewGlobalPolicyRelease` (separate feature).
- Keep `buildActionOutputConstraints` — used by `prompt-builder.ts`.
- Update tests to remove legacy mock data and `promptFamily` references.

---

## Files To Change

### Core

| File                                                              | Change                                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/agent/execution/persona-interaction-stage-service.ts` | Remove `useV2` conditional, hardcode `buildV2Blocks`. Remove `buildPromptBlocks` and `formatAgentProfile` imports. Remove `promptFamily` from `PersonaInteractionStageInput`. |
| `src/lib/ai/admin/control-plane-shared.ts`                        | Delete `formatAgentProfile`.                                                                                                                                                  |
| `src/lib/ai/agent/execution/flows/types.ts`                       | Remove `promptFamily` from `TextFlowModuleRunInput.runPersonaInteractionStage` callback parameter.                                                                            |

### Tests

| File                                                                       | Change                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`     | Remove legacy mock data, update to expect v2 paths. |
| `src/lib/ai/agent/execution/persona-interaction-service.test.ts`           | Remove `promptFamily` references if any.            |
| `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`                | Remove `promptFamily` references if any.            |
| `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`             | Same.                                               |
| `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`               | Same.                                               |
| `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts` | Update if legacy prompt format is asserted.         |

---

## Before / After

### `runStage()` — Before

```typescript
const useV2 = input.promptFamily === "persona_core_v2";

const blocks = useV2
  ? buildV2Blocks({ input, personaCore, contentMode, personaPacket, personaPacketText })
  : buildPromptBlocks({
      actionType: input.taskType,
      globalDraft: input.document.globalPolicyDraft,
      outputStyle: input.document.globalPolicyDraft.styleGuide,
      agentProfile: formatAgentProfile({
        displayName: profile.persona.display_name,
        username: profile.persona.username,
        bio: profile.persona.bio,
      }),
      plannerMode:
        input.taskType === "post_plan"
          ? "This stage is planning and scoring, not final writing."
          : undefined,
      agentCore: personaPacketText,
      boardContext: input.boardContextText ?? formatBoardContext(input.boardContext),
      targetContext:
        input.targetContextText ??
        formatTargetContext({
          taskType: input.taskType,
          targetContext: input.targetContext,
        }),
      taskContext: input.taskContext,
    });
```

### `runStage()` — After

```typescript
const blocks = buildV2Blocks({
  input,
  personaCore,
  contentMode,
  personaPacket,
  personaPacketText,
});
```

### `PersonaInteractionStageInput` — Before

```typescript
export type PersonaInteractionStageInput = {
  // ... existing fields ...
  promptFamily?: PersonaPromptFamilyMode;
};
```

### `PersonaInteractionStageInput` — After

`promptFamily` removed. `PersonaPromptFamilyMode` type deleted.

---

## What `buildV2Blocks` Already Handles

The v2 path already covers all taskTypes and fallbacks:

- Maps `taskType` to `PersonaFlowKind` via `ACTION_TYPE_TO_FLOW` (post → post_body, comment → comment, reply → reply, post_plan → post_plan, post_body → post_body)
- Falls back to `buildLeanStageBlocks` if `personaPacket` is null (system_baseline + global_policy + task_context only)
- Uses `buildPersonaPromptFamilyV2` which produces: system_baseline, global_policy, action_mode_policy, content_mode_policy, persona_runtime_packet, board_context, target_context, task_context, output_contract, anti_generic_contract
- Splits into `system` + `user` messages (better for models that support it)
- `output_contract` is schema-aware per flow (not hardcoded strings)

No feature gap — v2 covers everything legacy did and more.

---

## Known Gap: vote / poll_post / poll_vote

`ACTION_TYPE_TO_FLOW` maps these to `null`. In legacy, they got full blocks via `buildPromptBlocks`. In v2, they fall back to `buildLeanStageBlocks` (system_baseline + global_policy + task_context only).

These types never had structured output schemas (`resolveStageSchema` returns `undefined`), and go through `invokeRawAndReturn` in both paths. The lean blocks are sufficient for basic vote/poll preview.

A comment is added in `ACTION_TYPE_TO_FLOW` noting that vote/poll_post/poll_vote flow definitions are not yet implemented — future development.

## Not Removed

- `buildPromptBlocks` — still used by `AdminAiControlPlaneStore.previewGlobalPolicyRelease()` (policy-only admin preview, not persona interaction)
- `buildActionOutputConstraints` — used by `prompt-builder.ts` for non-stage prompt assembly
- `formatBoardContext`, `formatTargetContext` — used by `buildV2Blocks` and other v2 paths
