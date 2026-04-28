import { describe, it, expect } from "vitest";
import {
  normalizeText,
  extractJsonFromText,
  parseJsonObject,
  readStringArray,
  readCheckStatus,
} from "./json-parse-utils";

describe("json-parse-utils", () => {
  describe("normalizeText", () => {
    it("trims and normalizes CRLF", () => {
      expect(normalizeText(" \r\n hello \r\n world \r\n ")).toBe("hello \n world");
    });
  });

  describe("extractJsonFromText", () => {
    it("returns empty string if empty", () => {
      expect(extractJsonFromText("   ")).toBe("");
    });
    it("extracts from json fences", () => {
      expect(extractJsonFromText('some text\n```json\n{"a":1}\n```\nend text')).toBe('{"a":1}');
    });
    it("extracts from plain fences", () => {
      expect(extractJsonFromText('some text\n```\n{"a":1}\n```\nend text')).toBe('{"a":1}');
    });
    it("returns full text if no fences", () => {
      expect(extractJsonFromText('{"a":1}')).toBe('{"a":1}');
    });
  });

  describe("parseJsonObject", () => {
    const errorFactory = (type: string) => new Error(`Test error: ${type}`);

    it("parses valid JSON object", () => {
      expect(parseJsonObject('{"a": 1}', errorFactory)).toEqual({ a: 1 });
    });

    it("throws empty error on empty string", () => {
      expect(() => parseJsonObject("   ", errorFactory)).toThrow("Test error: empty");
    });

    it("throws invalid_json error on bad JSON", () => {
      expect(() => parseJsonObject("{a: 1}", errorFactory)).toThrow("Test error: invalid_json");
    });

    it("throws invalid_shape error on JSON array", () => {
      expect(() => parseJsonObject("[1, 2, 3]", errorFactory)).toThrow("Test error: invalid_shape");
    });

    it("throws invalid_shape error on JSON null", () => {
      expect(() => parseJsonObject("null", errorFactory)).toThrow("Test error: invalid_shape");
    });
  });

  describe("readStringArray", () => {
    it("returns null if not array", () => {
      expect(readStringArray(null)).toBeNull();
      expect(readStringArray("string")).toBeNull();
    });

    it("returns array of non-empty normalized strings", () => {
      expect(readStringArray([" hello ", " ", "world\r\n", 123])).toEqual(["hello", "world"]);
    });
  });

  describe("readCheckStatus", () => {
    it("returns pass or fail", () => {
      expect(readCheckStatus("pass")).toBe("pass");
      expect(readCheckStatus("fail")).toBe("fail");
    });

    it("returns null for anything else", () => {
      expect(readCheckStatus("other")).toBeNull();
      expect(readCheckStatus(null)).toBeNull();
      expect(readCheckStatus(123)).toBeNull();
    });
  });
});
