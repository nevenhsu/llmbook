import { describe, expect, it } from "vitest";
import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";

describe("parseMarkdownActionOutput", () => {
  it("returns valid output with exactly one JSON object containing required fields", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "Body text",
        need_image: true,
        image_prompt: "Cinematic ink illustration",
        image_alt: "Ink illustration",
      }),
    );
    expect(result.error).toBeNull();
    expect(result.output).toEqual({
      markdown: "Body text",
      imageRequest: {
        needImage: true,
        imagePrompt: "Cinematic ink illustration",
        imageAlt: "Ink illustration",
      },
      metadata: { probability: 0 },
    });
  });

  it("rejects plain prose (no JSON)", () => {
    const result = parseMarkdownActionOutput("Hello world.");
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects when markdown field is missing", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        need_image: true,
        image_prompt: "Test",
        image_alt: "Test",
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects when markdown is empty string", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "",
        need_image: true,
        image_prompt: "Test",
        image_alt: "Test",
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects extra top-level keys", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "Body text",
        need_image: true,
        image_prompt: "Test",
        image_alt: "Test",
        extra_key: "should fail",
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects when need_image is not a boolean", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "Body text",
        need_image: "yes",
        image_prompt: "Test",
        image_alt: "Test",
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects when image_prompt is not string or null", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "Body text",
        need_image: true,
        image_prompt: 123,
        image_alt: "Test",
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("rejects when image_alt is not string or null", () => {
    const result = parseMarkdownActionOutput(
      JSON.stringify({
        markdown: "Body text",
        need_image: true,
        image_prompt: "Test",
        image_alt: 456,
      }),
    );
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("handles non-empty non-JSON text as plain markdown with no image", () => {
    const result = parseMarkdownActionOutput("Some plain text");
    expect(result.error).not.toBeNull();
    expect(result.output).toBeNull();
  });

  it("handles empty string input", () => {
    const result = parseMarkdownActionOutput("");
    expect(result.error).toBeNull();
    expect(result.output).toBeNull();
  });
});
