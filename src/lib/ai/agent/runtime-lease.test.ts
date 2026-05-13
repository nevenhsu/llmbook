import { describe, expect, it } from "vitest";
import { claimLease, heartbeatLease, buildLeaseSnapshot, isAppOnline } from "./runtime-lease";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("claimLease", () => {
  it("claims when no current lease holder", () => {
    const result = claimLease(null, {
      leaseOwner: "me",
      leaseMs: 60_000,
      now: NOW,
    });
    expect(result.result).toBe("claimed");
    expect(result.nextLeaseUntil).toBe("2026-01-01T00:01:00.000Z");
  });

  it("blocks when paused", () => {
    const result = claimLease(
      { paused: true, leaseOwner: null, leaseUntil: null, cooldownUntil: null },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW },
    );
    expect(result.result).toBe("blocked");
  });

  it("blocks when another owner holds an active lease", () => {
    const result = claimLease(
      {
        paused: false,
        leaseOwner: "other",
        leaseUntil: "2026-01-01T00:05:00.000Z",
        cooldownUntil: null,
      },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW },
    );
    expect(result.result).toBe("blocked");
  });

  it("renews when same owner holds the lease", () => {
    const result = claimLease(
      {
        paused: false,
        leaseOwner: "me",
        leaseUntil: "2026-01-01T00:00:30.000Z",
        cooldownUntil: null,
      },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW },
    );
    expect(result.result).toBe("claimed");
    expect(result.nextLeaseUntil).toBe("2026-01-01T00:01:00.000Z");
  });

  it("blocks when cooldown is active and allowDuringCooldown is not set", () => {
    const result = claimLease(
      {
        paused: false,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-01-01T00:05:00.000Z",
      },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW },
    );
    expect(result.result).toBe("blocked");
  });

  it("claims when cooldown is active but allowDuringCooldown is true", () => {
    const result = claimLease(
      {
        paused: false,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-01-01T00:05:00.000Z",
      },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW, allowDuringCooldown: true },
    );
    expect(result.result).toBe("claimed");
  });
});

describe("heartbeatLease", () => {
  it("extends lease when same owner", () => {
    const result = heartbeatLease(
      {
        paused: false,
        leaseOwner: "me",
        leaseUntil: "2026-01-01T00:00:30.000Z",
        cooldownUntil: null,
      },
      { leaseOwner: "me", leaseMs: 60_000, now: NOW },
    );
    expect(result.nextLeaseUntil).toBe("2026-01-01T00:01:00.000Z");
  });

  it("returns existing row when different owner", () => {
    const row = {
      paused: false,
      leaseOwner: "other",
      leaseUntil: "2026-01-01T00:05:00.000Z",
      cooldownUntil: null,
    };
    const result = heartbeatLease(row, { leaseOwner: "me", leaseMs: 60_000, now: NOW });
    expect(result.nextLeaseUntil).toBe("2026-01-01T00:05:00.000Z");
  });
});

describe("buildLeaseSnapshot", () => {
  it("returns idle when no row", () => {
    const snapshot = buildLeaseSnapshot(null, NOW);
    expect(snapshot.available).toBe(true);
    expect(snapshot.leaseOwner).toBeNull();
  });

  it("returns available when lease expired", () => {
    const snapshot = buildLeaseSnapshot(
      {
        paused: false,
        leaseOwner: "old-owner",
        leaseUntil: "2025-12-31T23:59:00.000Z",
        cooldownUntil: null,
      },
      NOW,
    );
    expect(snapshot.available).toBe(true);
    expect(snapshot.leaseOwner).toBeNull();
  });

  it("returns not available when lease is active", () => {
    const snapshot = buildLeaseSnapshot(
      {
        paused: false,
        leaseOwner: "runner",
        leaseUntil: "2026-01-01T00:05:00.000Z",
        cooldownUntil: null,
      },
      NOW,
    );
    expect(snapshot.available).toBe(false);
    expect(snapshot.leaseOwner).toBe("runner");
  });
});

describe("isAppOnline", () => {
  const ONLINE_WINDOW_MS = 30_000;

  it("returns true when app was seen recently", () => {
    expect(isAppOnline("2026-01-01T00:00:00.000Z", NOW, ONLINE_WINDOW_MS)).toBe(true);
  });

  it("returns false when app was not seen recently", () => {
    expect(
      isAppOnline(
        "2026-01-01T00:00:00.000Z",
        new Date("2026-01-01T00:01:00.000Z"),
        ONLINE_WINDOW_MS,
      ),
    ).toBe(false);
  });

  it("returns false when seenAt is null", () => {
    expect(isAppOnline(null, NOW, ONLINE_WINDOW_MS)).toBe(false);
  });
});
