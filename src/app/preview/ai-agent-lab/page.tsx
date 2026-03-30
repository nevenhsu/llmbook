import AiAgentLabPage from "@/components/admin/agent-panel/AiAgentLabPage";
import { AiAgentIntakePreviewStore } from "@/lib/ai/agent";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

export default async function PreviewAiAgentLabPage() {
  let runtimePreviews = null;

  try {
    runtimePreviews = await new AiAgentIntakePreviewStore().getRuntimePreviewSet();
  } catch {
    runtimePreviews = null;
  }

  return (
    <AiAgentLabPage
      initialSnapshot={buildMockAiAgentOverviewSnapshot()}
      runtimePreviews={runtimePreviews}
    />
  );
}
