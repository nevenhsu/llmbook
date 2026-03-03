import { describe, expect, it } from "vitest";
import { getOrderedTargetsFromInventory } from "@/lib/ai/llm/active-order-inventory";

type Provider = {
  id: string;
  providerKey: string;
  status: "active" | "disabled";
  hasKey: boolean;
};

type Model = {
  id: string;
  providerId: string;
  modelKey: string;
  capability: "text_generation" | "image_generation";
  status: "active" | "disabled";
  testStatus?: "untested" | "success" | "failed";
  lifecycleStatus?: "active" | "retired";
  displayOrder?: number | null;
  supportsImageInputPrompt?: boolean;
};

function buildProvider(overrides?: Partial<Provider>): Provider {
  return {
    id: "p-xai",
    providerKey: "xai",
    status: "active",
    hasKey: false,
    ...overrides,
  };
}

function buildModel(overrides?: Partial<Model>): Model {
  return {
    id: "m-1",
    providerId: "p-xai",
    modelKey: "grok-4-1-fast-reasoning",
    capability: "text_generation",
    status: "active",
    testStatus: "untested",
    lifecycleStatus: "active",
    displayOrder: 0,
    supportsImageInputPrompt: false,
    ...overrides,
  };
}

describe("active order routing workflow", () => {
  it("reflects key/test/active/order state transitions", () => {
    const providerNoKey = buildProvider({ hasKey: false });
    const modelUntested = buildModel({ testStatus: "untested" });

    const step1 = getOrderedTargetsFromInventory({
      providers: [providerNoKey],
      models: [modelUntested],
      capability: "text_generation",
    });
    expect(step1).toEqual([]);

    const step2 = getOrderedTargetsFromInventory({
      providers: [buildProvider({ hasKey: true })],
      models: [buildModel({ testStatus: "untested" })],
      capability: "text_generation",
    });
    expect(step2).toEqual([]);

    const step3 = getOrderedTargetsFromInventory({
      providers: [buildProvider({ hasKey: true })],
      models: [buildModel({ testStatus: "success" })],
      capability: "text_generation",
    });
    expect(step3).toEqual([{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }]);

    const step4 = getOrderedTargetsFromInventory({
      providers: [buildProvider({ hasKey: true })],
      models: [
        buildModel({
          id: "m-1",
          modelKey: "grok-4-1-fast-reasoning",
          testStatus: "success",
          displayOrder: 0,
        }),
        buildModel({
          id: "m-2",
          modelKey: "grok-4-1-fast-reasoning-v2",
          testStatus: "success",
          displayOrder: 1,
        }),
      ],
      capability: "text_generation",
    });
    expect(step4).toEqual([
      { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      { providerId: "xai", modelId: "grok-4-1-fast-reasoning-v2" },
    ]);

    const step5 = getOrderedTargetsFromInventory({
      providers: [buildProvider({ hasKey: true })],
      models: [
        buildModel({
          id: "m-1",
          modelKey: "grok-4-1-fast-reasoning",
          testStatus: "success",
          lifecycleStatus: "retired",
          displayOrder: 0,
        }),
        buildModel({
          id: "m-2",
          modelKey: "grok-4-1-fast-reasoning-v2",
          testStatus: "success",
          displayOrder: 1,
        }),
      ],
      capability: "text_generation",
    });
    expect(step5).toEqual([{ providerId: "xai", modelId: "grok-4-1-fast-reasoning-v2" }]);
  });

  it("filters text route by prompt modality for multimodal prompts", () => {
    const providers: Provider[] = [buildProvider({ hasKey: true })];
    const models: Model[] = [
      buildModel({
        id: "m-text",
        modelKey: "grok-4-1-fast-reasoning",
        testStatus: "success",
        supportsImageInputPrompt: false,
      }),
      buildModel({
        id: "m-mm",
        modelKey: "grok-4-1-fast-reasoning-mm",
        testStatus: "success",
        supportsImageInputPrompt: true,
        displayOrder: 1,
      }),
    ];

    const textOnly = getOrderedTargetsFromInventory({
      providers,
      models,
      capability: "text_generation",
      promptModality: "text_only",
    });
    const textImage = getOrderedTargetsFromInventory({
      providers,
      models,
      capability: "text_generation",
      promptModality: "text_image",
    });

    expect(textOnly).toEqual([
      { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      { providerId: "xai", modelId: "grok-4-1-fast-reasoning-mm" },
    ]);
    expect(textImage).toEqual([{ providerId: "xai", modelId: "grok-4-1-fast-reasoning-mm" }]);
  });
});
