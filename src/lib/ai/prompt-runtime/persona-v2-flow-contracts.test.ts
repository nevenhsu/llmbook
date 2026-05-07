import { describe, it, expect } from "vitest";
import {
  buildOutputContractV2,
  buildAuditOutputContractV2,
  parseMetadataProbability,
  normalizeMetadataProbability,
} from "./persona-v2-flow-contracts";

describe("persona-v2-flow-contracts", () => {
  describe("buildOutputContractV2", () => {
    it("includes metadata.probability for post_body", () => {
      const contract = buildOutputContractV2({ flow: "post_body", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
      expect(contract).toContain("0 to 100");
    });

    it("includes metadata.probability for post", () => {
      const contract = buildOutputContractV2({ flow: "post", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("includes metadata.probability for comment", () => {
      const contract = buildOutputContractV2({ flow: "comment", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("includes metadata.probability for reply", () => {
      const contract = buildOutputContractV2({ flow: "reply", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("post_plan does NOT include metadata.probability", () => {
      const contract = buildOutputContractV2({ flow: "post_plan", contentMode: "discussion" });
      expect(contract).not.toContain("probability");
      expect(contract).toContain("candidates"); // post_plan uses candidate schema
    });

    it("post_plan story mode maps to story title and thesis", () => {
      const contract = buildOutputContractV2({ flow: "post_plan", contentMode: "story" });
      expect(contract).toContain("story");
      expect(contract).toContain("candidates");
      // Uses same candidate schema, story semantics from content_mode_policy
    });

    it("post_body story mode keeps same JSON keys", () => {
      const contract = buildOutputContractV2({ flow: "post_body", contentMode: "story" });
      expect(contract).toContain("body");
      expect(contract).toContain("tags");
      expect(contract).not.toContain("title");
      expect(contract).toContain("metadata");
    });

    it("comment story mode keeps same markdown-plus-metadata contract", () => {
      const contract = buildOutputContractV2({ flow: "comment", contentMode: "story" });
      expect(contract).toContain("markdown");
      expect(contract).toContain("metadata");
      expect(contract).not.toContain("title");
    });

    it("reply story mode keeps same markdown-plus-metadata contract", () => {
      const contract = buildOutputContractV2({ flow: "reply", contentMode: "story" });
      expect(contract).toContain("markdown");
      expect(contract).toContain("metadata");
    });

    it("all writer contracts include JSON-only instruction", () => {
      for (const flow of ["post_body", "post", "comment", "reply"] as const) {
        const contract = buildOutputContractV2({ flow, contentMode: "discussion" });
        expect(contract).toContain("JSON");
      }
    });
  });

  describe("buildAuditOutputContractV2", () => {
    it("does not score, validate, or explain probability", () => {
      for (const flow of ["post_body", "comment", "reply"] as const) {
        const contract = buildAuditOutputContractV2({ flow, contentMode: "discussion" });
        expect(contract).not.toContain("probability");
      }
    });

    it("includes audit-specific keys", () => {
      const contract = buildAuditOutputContractV2({ flow: "post_body", contentMode: "discussion" });
      expect(contract).toContain("passes");
      expect(contract).toContain("issues");
    });
  });

  describe("parseMetadataProbability", () => {
    it("returns valid integer as-is", () => {
      expect(parseMetadataProbability(85)).toBe(85);
      expect(parseMetadataProbability(0)).toBe(0);
      expect(parseMetadataProbability(100)).toBe(100);
      expect(parseMetadataProbability(50)).toBe(50);
    });

    it("defaults missing to 0", () => {
      expect(parseMetadataProbability(undefined)).toBe(0);
      expect(parseMetadataProbability(null)).toBe(0);
    });

    it("defaults non-integer to 0", () => {
      expect(parseMetadataProbability(85.5)).toBe(0);
      expect(parseMetadataProbability("85")).toBe(0);
      expect(parseMetadataProbability(true)).toBe(0);
      expect(parseMetadataProbability([])).toBe(0);
      expect(parseMetadataProbability({})).toBe(0);
    });

    it("defaults out-of-range to 0", () => {
      expect(parseMetadataProbability(-1)).toBe(0);
      expect(parseMetadataProbability(101)).toBe(0);
      expect(parseMetadataProbability(1000)).toBe(0);
      expect(parseMetadataProbability(-100)).toBe(0);
    });

    it("handles edge cases", () => {
      expect(parseMetadataProbability(NaN)).toBe(0);
      expect(parseMetadataProbability(Infinity)).toBe(0);
      expect(parseMetadataProbability(-Infinity)).toBe(0);
    });
  });

  describe("normalizeMetadataProbability", () => {
    it("extracts probability from metadata record", () => {
      expect(normalizeMetadataProbability({ probability: 75 })).toEqual({ probability: 75 });
    });

    it("defaults missing metadata to 0", () => {
      expect(normalizeMetadataProbability(undefined)).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability(null)).toEqual({ probability: 0 });
    });

    it("defaults non-object metadata to 0", () => {
      expect(normalizeMetadataProbability("nope")).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability(42)).toEqual({ probability: 0 });
    });

    it("defaults missing probability field to 0", () => {
      expect(normalizeMetadataProbability({ other: 1 })).toEqual({ probability: 0 });
    });

    it("clamps and validates through parseMetadataProbability", () => {
      expect(normalizeMetadataProbability({ probability: -5 })).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability({ probability: 101 })).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability({ probability: 88.5 })).toEqual({ probability: 0 });
    });
  });
});
