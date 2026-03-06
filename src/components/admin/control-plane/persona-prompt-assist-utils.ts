import { formatPersonaGenerationElapsed } from "@/components/admin/control-plane/persona-generation-modal-utils";

export function readPromptAssistButtonMode(isLoading: boolean): "idle" | "cancel" {
  return isLoading ? "cancel" : "idle";
}

export function formatPromptAssistStatus(
  isLoading: boolean,
  elapsedSeconds: number,
  errorMessage: string | null,
): string | null {
  if (isLoading) {
    return `AI assist processing ${formatPersonaGenerationElapsed(elapsedSeconds)}`;
  }
  if (errorMessage) {
    return errorMessage;
  }
  return null;
}
