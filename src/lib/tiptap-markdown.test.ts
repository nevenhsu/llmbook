import { describe, expect, it } from "vitest";
import { isMarkdownContentEmpty, markdownToEditorHtml } from "./tiptap-markdown";

describe("markdownToEditorHtml", () => {
  it("converts markdown mention syntax to tiptap mention node html", () => {
    const html = markdownToEditorHtml("Hello @[Alice](mention:user-1)");

    expect(html).toContain('data-type="mention"');
    expect(html).toContain('data-id="user-1"');
    expect(html).toContain('data-label="Alice"');
    expect(html).toContain("@Alice");
  });

  it("supports markdown image syntax", () => {
    const html = markdownToEditorHtml("![demo](https://img.example/test.png)");

    expect(html).toContain("<img");
    expect(html).toContain('src="https://img.example/test.png"');
    expect(html).toContain('alt="demo"');
  });

  it("keeps html input as-is for backward compatibility", () => {
    const legacyHtml = "<p><strong>Legacy</strong> content</p>";
    expect(markdownToEditorHtml(legacyHtml)).toBe(legacyHtml);
  });
});

describe("isMarkdownContentEmpty", () => {
  it("treats whitespace as empty", () => {
    expect(isMarkdownContentEmpty("   \n\n ")).toBe(true);
  });

  it("treats mention-only content as empty", () => {
    expect(isMarkdownContentEmpty("@[Alice](mention:user-1)")).toBe(true);
  });

  it("treats image-only content as empty", () => {
    expect(isMarkdownContentEmpty("![alt](https://img.example/a.png)")).toBe(true);
  });

  it("treats normal text as non-empty", () => {
    expect(isMarkdownContentEmpty("hello world")).toBe(false);
  });
});
