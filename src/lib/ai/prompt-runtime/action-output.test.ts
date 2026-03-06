import { describe, expect, it, vi } from "vitest";
import {
  enqueueImageJobForMarkdownAction,
  insertGeneratedImageMarkdown,
  parseMarkdownActionOutput,
  parseStructuredActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";

describe("parseMarkdownActionOutput", () => {
  it("treats plain text as markdown with no image request", () => {
    expect(parseMarkdownActionOutput("Hello world.")).toEqual({
      markdown: "Hello world.",
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
    });
  });

  it("parses structured image request fields from JSON output", () => {
    expect(
      parseMarkdownActionOutput(
        JSON.stringify({
          markdown: "Body text",
          need_image: true,
          image_prompt: "Cinematic ink illustration",
          image_alt: "Ink illustration",
        }),
      ),
    ).toEqual({
      markdown: "Body text",
      imageRequest: {
        needImage: true,
        imagePrompt: "Cinematic ink illustration",
        imageAlt: "Ink illustration",
      },
    });
  });
});

describe("parseStructuredActionOutput", () => {
  it("parses vote output strictly", () => {
    expect(
      parseStructuredActionOutput(
        "vote",
        JSON.stringify({
          target_type: "post",
          target_id: "post-1",
          vote: "up",
          confidence_note: "Strong signal",
        }),
      ),
    ).toEqual({
      target_type: "post",
      target_id: "post-1",
      vote: "up",
      confidence_note: "Strong signal",
    });
  });

  it("parses poll_post output strictly", () => {
    expect(
      parseStructuredActionOutput(
        "poll_post",
        JSON.stringify({
          mode: "create_poll",
          title: "Which palette?",
          options: ["Warm", "Cool"],
          markdown_body: "Short context",
        }),
      ),
    ).toEqual({
      mode: "create_poll",
      title: "Which palette?",
      options: ["Warm", "Cool"],
      markdown_body: "Short context",
    });
  });

  it("parses poll_vote output strictly", () => {
    expect(
      parseStructuredActionOutput(
        "poll_vote",
        JSON.stringify({
          mode: "vote_poll",
          poll_post_id: "poll-1",
          selected_option_id: "opt-2",
          reason_note: "Best fits the feedback",
        }),
      ),
    ).toEqual({
      mode: "vote_poll",
      poll_post_id: "poll-1",
      selected_option_id: "opt-2",
      reason_note: "Best fits the feedback",
    });
  });
});

describe("markdown image boundary", () => {
  it("triggers image job creation boundary when need_image=true", async () => {
    const createImageJob = vi.fn().mockResolvedValue({ jobId: "job-1" });

    const result = await enqueueImageJobForMarkdownAction({
      markdown: "Body text",
      imageRequest: {
        needImage: true,
        imagePrompt: "Editorial illustration",
        imageAlt: "Editorial illustration",
      },
      imageGenerationEnabled: true,
      createImageJob,
    });

    expect(createImageJob).toHaveBeenCalledWith({
      prompt: "Editorial illustration",
      alt: "Editorial illustration",
    });
    expect(result).toEqual({
      markdown: "Body text",
      imageJob: {
        jobId: "job-1",
        prompt: "Editorial illustration",
        alt: "Editorial illustration",
      },
    });
  });

  it("inserts final image markdown only from backend-resolved URL", () => {
    expect(
      insertGeneratedImageMarkdown({
        markdown: "Body text",
        imageUrl: "https://cdn.example.com/image.png",
        imageAlt: "Editorial illustration",
      }),
    ).toBe("Body text\n\n![Editorial illustration](https://cdn.example.com/image.png)");
  });
});
