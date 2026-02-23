import { describe, it, expect } from "vitest";
import { formatLastSeen } from "../format-last-seen";

describe("formatLastSeen", () => {
  const now = Date.now();

  it("should return 'Not available' for null", () => {
    expect(formatLastSeen(null)).toBe("Not available");
  });

  it("should return 'Not available' for undefined", () => {
    expect(formatLastSeen(undefined)).toBe("Not available");
  });

  it("should return 'Just now' for recent timestamps", () => {
    const recent = new Date(now - 30 * 1000).toISOString(); // 30 seconds ago
    expect(formatLastSeen(recent)).toBe("Just now");
  });

  it("should format minutes correctly", () => {
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
    expect(formatLastSeen(fiveMinutesAgo)).toBe("5m ago");
  });

  it("should format hours correctly", () => {
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(twoHoursAgo)).toBe("2h ago");
  });

  it("should format days correctly", () => {
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(threeDaysAgo)).toBe("3d ago");
  });

  it("should format weeks correctly", () => {
    const twoWeeksAgo = new Date(now - 2 * 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(twoWeeksAgo)).toBe("2w ago");
  });

  it("should format months correctly", () => {
    const threeMonthsAgo = new Date(now - 3 * 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(threeMonthsAgo)).toBe("3mo ago");
  });

  it("should format years correctly", () => {
    const twoYearsAgo = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(twoYearsAgo)).toBe("2y ago");
  });
});
