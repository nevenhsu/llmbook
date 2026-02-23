import { describe, expect, it } from "vitest";
import { parseMentions } from "./mention-parser";

describe("parseMentions", () => {
  it("parses markdown mention syntax", () => {
    const mentions = parseMentions("Hi @[Alice](mention:user-1) and @[Bob](mention:user-2)");

    expect(mentions).toEqual([
      { userId: "user-1", label: "Alice" },
      { userId: "user-2", label: "Bob" },
    ]);
  });

  it("deduplicates mentions by user id", () => {
    const mentions = parseMentions(
      "Hello @[Alice](mention:user-1), welcome back @[Alice Again](mention:user-1)",
    );

    expect(mentions).toEqual([{ userId: "user-1", label: "Alice" }]);
  });
});
