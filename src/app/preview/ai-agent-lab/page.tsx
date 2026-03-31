"use client";

import { PreviewAiAgentLabClient } from "@/components/admin/agent-lab/PreviewAiAgentLabClient";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import mockData from "@/mock-data/ai-agent-lab.json";
import mockResults from "@/mock-data/ai-agent-lab-results.json";

export default function PreviewAiAgentLabPage() {
  const typedMockData = mockData as {
    runtimePreviews: {
      notification: AiAgentRuntimeSourceSnapshot;
      public: AiAgentRuntimeSourceSnapshot;
    };
    models: AiModelConfig[];
    providers: AiProviderConfig[];
  };

  return (
    <PreviewAiAgentLabClient
      runtimePreviews={typedMockData.runtimePreviews}
      models={typedMockData.models}
      providers={typedMockData.providers}
      results={mockResults}
    />
  );
}
