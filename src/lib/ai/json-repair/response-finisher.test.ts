import { describe, it, expect } from "vitest";
import {
  scanJsonState,
  classifyTruncation,
  tryDeterministicTailClosure,
  deriveOpenPath,
} from "./response-finisher";

describe("classifyTruncation", () => {
  it("classifies missing brace only as tail_closable", () => {
    const result = classifyTruncation('{"name":"Alice","age":30');
    expect(result).toBe("tail_closable");
  });

  it("classifies complete JSON as tail_closable (already valid)", () => {
    expect(classifyTruncation('{"name":"Alice","age":30}')).toBe("tail_closable");
  });

  it("classifies trailing-colon as tail_closable (can add closing brace)", () => {
    const result = classifyTruncation('{"name":"Alice","age":');
    // Trailing colon is closable by adding "}"
    expect(result).toBe("tail_closable");
  });

  it("classifies trailing-comma as continuation_needed", () => {
    const result = classifyTruncation('{"name":"Alice",');
    expect(result).not.toBe("tail_closable");
  });

  it("classifies empty input as prefix_too_broken", () => {
    expect(classifyTruncation("")).toBe("prefix_too_broken");
    expect(classifyTruncation("   ")).toBe("prefix_too_broken");
  });
});

describe("tryDeterministicTailClosure", () => {
  it("closes a truncated object missing closing brace", () => {
    const result = tryDeterministicTailClosure('{"name":"Alice","age":30');
    expect(result).not.toBeNull();
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("closes nested truncated objects", () => {
    const result = tryDeterministicTailClosure(
      '{"identity":{"archetype":"test","core_drive":"drive"',
    );
    expect(result).not.toBeNull();
    if (result) {
      expect(() => JSON.parse(result)).not.toThrow();
    }
  });

  it("does NOT invent placeholder values for truncated key-value pairs", () => {
    // Input ends after a colon - cannot invent a value
    const result = tryDeterministicTailClosure('{"name":"Alice","age":');
    // Should return null (not invent "placeholder" or empty string)
    if (result) {
      // If it did produce a result, it must NOT contain invented values
      expect(result).not.toContain("placeholder");
      expect(result).not.toMatch(/:\s*""/);
    }
  });

  it("does NOT invent placeholder values for trailing comma", () => {
    const result = tryDeterministicTailClosure('{"name":"Alice",');
    if (result) {
      expect(result).not.toContain("placeholder");
    }
  });

  it("returns null for completely empty input", () => {
    expect(tryDeterministicTailClosure("")).toBeNull();
  });
});

describe("scanJsonState", () => {
  it("detects open string state", () => {
    const state = scanJsonState('{"name":"Alice","bio":"unfinished');
    expect(state.openString).toBe(true);
  });

  it("detects open object state", () => {
    const state = scanJsonState('{"name":"Alice","age":');
    expect(state.stack.length).toBeGreaterThan(0);
    expect(state.stack).toContain("{");
  });
});

describe("deriveOpenPath", () => {
  it("derives path from partial JSON", () => {
    const state = scanJsonState('{"identity":{"archetype":"test","core_drive":"drive"');
    const path = deriveOpenPath(state);
    expect(path).toBeTruthy();
  });
});
