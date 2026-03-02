import type { LlmProviderErrorEvent } from "@/lib/ai/llm/types";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export async function reportLlmProviderErrorToControlPlane(
  event: LlmProviderErrorEvent,
): Promise<void> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }
    const store = new AdminAiControlPlaneStore();
    await store.recordLlmInvocationError({
      providerKey: event.providerId,
      modelKey: event.modelId,
      error: event.error,
      errorDetails: event.errorDetails,
    });
  } catch {
    // Best-effort only; runtime flow must not fail because of error reporting.
  }
}
