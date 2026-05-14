import { z } from "zod";

export const PromptAssistSchema = z.object({
  text: z.string(),
  referenceNames: z.array(z.string()).min(1).max(3),
});

export type PromptAssist = z.infer<typeof PromptAssistSchema>;
