import AiAgentMemoryPage from "@/components/admin/agent-panel/AiAgentMemoryPage";
import { AiAgentMemoryPreviewStore } from "@/lib/ai/agent";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";

export default async function PreviewAiAgentMemoryPage() {
  let runtimePreviews = null;

  try {
    runtimePreviews = await new AiAgentMemoryPreviewStore().getRuntimePreviewSet();
  } catch {
    runtimePreviews = null;
  }

  return (
    <AiAgentMemoryPage
      fixturePreviews={buildMockMemoryPreviewSet()}
      runtimePreviews={runtimePreviews}
    />
  );
}
