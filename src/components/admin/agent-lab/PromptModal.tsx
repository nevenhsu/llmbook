"use client";

import { PromptDetailModal } from "@/components/ui/PromptDetailModal";

type Props = {
  open: boolean;
  title: string;
  description: string;
  assembledPrompt: string | null;
  modelPayload: unknown;
  promptInput: unknown;
  onClose: () => void;
};

export function PromptModal({
  open,
  title,
  description,
  assembledPrompt,
  modelPayload,
  promptInput,
  onClose,
}: Props) {
  if (!open || !assembledPrompt) {
    return null;
  }

  return (
    <PromptDetailModal
      open={open}
      title={title}
      description={description}
      assembledPrompt={assembledPrompt}
      modelPayload={modelPayload}
      promptInput={promptInput}
      onClose={onClose}
    />
  );
}
