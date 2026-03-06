import { describe, expect, it } from "vitest";
import type { PolicyReleaseListItem } from "@/lib/ai/admin/control-plane-store";
import {
  applyPolicyReleaseToDraft,
  isEligiblePersonaGenerationModel,
} from "@/hooks/admin/useAiControlPlane";
import type { DraftState } from "@/lib/ai/admin/control-plane-types";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-store";

function buildRelease(overrides: Partial<PolicyReleaseListItem> = {}): PolicyReleaseListItem {
  return {
    version: 7,
    isActive: true,
    createdBy: "admin",
    changeNote: "Updated tone guidance",
    createdAt: "2026-03-06T00:00:00.000Z",
    globalPolicyDraft: {
      systemBaseline: "baseline",
      globalPolicy: "policy",
      styleGuide: "style",
      forbiddenRules: "forbidden",
    },
    ...overrides,
  };
}

describe("applyPolicyReleaseToDraft", () => {
  it("restores the saved release note when switching policy versions", () => {
    const currentDraft: DraftState = {
      selectedVersion: 9,
      systemBaseline: "old baseline",
      globalPolicy: "old policy",
      styleGuide: "old style",
      forbiddenRules: "old forbidden",
      note: "",
    };

    const nextDraft = applyPolicyReleaseToDraft(currentDraft, buildRelease());

    expect(nextDraft).toEqual({
      selectedVersion: 7,
      systemBaseline: "baseline",
      globalPolicy: "policy",
      styleGuide: "style",
      forbiddenRules: "forbidden",
      note: "Updated tone guidance",
    });
  });

  it("clears the note when the selected release has no saved change note", () => {
    const currentDraft: DraftState = {
      selectedVersion: 9,
      systemBaseline: "old baseline",
      globalPolicy: "old policy",
      styleGuide: "old style",
      forbiddenRules: "old forbidden",
      note: "stale note",
    };

    const nextDraft = applyPolicyReleaseToDraft(
      currentDraft,
      buildRelease({
        version: 8,
        changeNote: null,
      }),
    );

    expect(nextDraft.note).toBe("");
    expect(nextDraft.selectedVersion).toBe(8);
  });
});

describe("isEligiblePersonaGenerationModel", () => {
  it("rejects models that are not test-success or are retired", () => {
    const provider: AiProviderConfig = {
      id: "provider-1",
      providerKey: "xai",
      displayName: "xAI",
      sdkPackage: "@ai-sdk/xai",
      status: "disabled",
      testStatus: "success",
      keyLast4: "1234",
      hasKey: true,
      lastApiErrorCode: null,
      lastApiErrorMessage: null,
      lastApiErrorAt: null,
      createdAt: "2026-03-06T00:00:00.000Z",
      updatedAt: "2026-03-06T00:00:00.000Z",
    };

    const baseModel: AiModelConfig = {
      id: "model-1",
      providerId: "provider-1",
      modelKey: "grok-4-1-fast-reasoning",
      displayName: "Grok",
      capability: "text_generation",
      status: "active",
      testStatus: "success",
      lifecycleStatus: "active",
      displayOrder: 1,
      lastErrorKind: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorAt: null,
      supportsInput: true,
      supportsImageInputPrompt: false,
      supportsOutput: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      metadata: {},
      updatedAt: "2026-03-06T00:00:00.000Z",
    };

    expect(isEligiblePersonaGenerationModel(baseModel, provider)).toBe(true);
    expect(isEligiblePersonaGenerationModel({ ...baseModel, testStatus: "failed" }, provider)).toBe(
      false,
    );
    expect(
      isEligiblePersonaGenerationModel({ ...baseModel, lifecycleStatus: "retired" }, provider),
    ).toBe(false);
  });
});
