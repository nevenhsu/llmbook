import type { PreviewResult } from "@/lib/ai/admin/control-plane-contract";
import {
  AiAgentPersonaInteractionService,
  type AiAgentPersonaInteractionInput,
} from "@/lib/ai/agent/execution/persona-interaction-service";

export async function previewPersonaInteraction(
  input: AiAgentPersonaInteractionInput,
): Promise<PreviewResult> {
  return new AiAgentPersonaInteractionService().run({ ...input, debug: true });
}
