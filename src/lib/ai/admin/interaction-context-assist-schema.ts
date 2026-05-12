import { z } from "zod";

export const InteractionContextAssistSchema = z.discriminatedUnion("taskType", [
  z.object({
    taskType: z.literal("post"),
    titleDirection: z.string(),
    contentDirection: z.string(),
  }),
  z.object({
    taskType: z.literal("comment"),
    articleTitle: z.string(),
    articleOutline: z.string(),
  }),
  z.object({
    taskType: z.literal("reply"),
    articleOutline: z.string(),
    comments: z
      .array(
        z.object({
          content: z.string(),
        }),
      )
      .length(3),
  }),
]);

export type InteractionContextAssistOutput = z.infer<typeof InteractionContextAssistSchema>;

export function serializeAssistOutput(output: InteractionContextAssistOutput): string {
  switch (output.taskType) {
    case "post":
      return `Title direction: ${output.titleDirection}\nContent direction: ${output.contentDirection}`;
    case "comment":
      return `Article: ${output.articleTitle}\nOutline: ${output.articleOutline}`;
    case "reply":
      return `Outline: ${output.articleOutline}\n\nComments:\n${output.comments
        .map((c, i) => `${i + 1}. ${c.content}`)
        .join("\n")}`;
  }
}
