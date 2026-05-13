export type LeaseCoreRow = {
  paused: boolean;
  leaseOwner: string | null;
  leaseUntil: string | null;
  cooldownUntil?: string | null;
};

export type LeaseSnapshot = {
  available: boolean;
  leaseOwner: string | null;
  leaseUntil: string | null;
};

export type LeaseClaimResult = {
  result: "claimed" | "blocked";
  nextLeaseUntil: string | null;
  reason?: string;
};

export function claimLease(
  row: LeaseCoreRow | null,
  input: {
    leaseOwner: string;
    leaseMs: number;
    now: Date;
    allowDuringCooldown?: boolean;
  },
): LeaseClaimResult {
  if (row?.paused) {
    return { result: "blocked", nextLeaseUntil: row.leaseUntil, reason: "Runtime is paused" };
  }

  if (row) {
    if (row.leaseOwner !== input.leaseOwner && row.leaseUntil) {
      const leaseExpiry = new Date(row.leaseUntil);
      if (leaseExpiry > input.now) {
        return {
          result: "blocked",
          nextLeaseUntil: row.leaseUntil,
          reason: `Lease held by ${row.leaseOwner} until ${row.leaseUntil}`,
        };
      }
    }

    if (row.cooldownUntil && !input.allowDuringCooldown) {
      const cooldownExpiry = new Date(row.cooldownUntil);
      if (cooldownExpiry > input.now) {
        return {
          result: "blocked",
          nextLeaseUntil: row.leaseUntil,
          reason: `Cooldown active until ${row.cooldownUntil}`,
        };
      }
    }
  }

  const nextLeaseUntil = new Date(input.now.getTime() + input.leaseMs).toISOString();
  return { result: "claimed", nextLeaseUntil };
}

export function heartbeatLease(
  row: LeaseCoreRow | null,
  input: {
    leaseOwner: string;
    leaseMs: number;
    now: Date;
  },
): { nextLeaseUntil: string | null } {
  if (row && row.leaseOwner === input.leaseOwner) {
    const nextLeaseUntil = new Date(input.now.getTime() + input.leaseMs).toISOString();
    return { nextLeaseUntil };
  }
  return { nextLeaseUntil: row?.leaseUntil ?? null };
}

export function buildLeaseSnapshot(row: LeaseCoreRow | null, now: Date): LeaseSnapshot {
  if (!row) {
    return { available: true, leaseOwner: null, leaseUntil: null };
  }

  if (row.leaseOwner && row.leaseUntil) {
    const leaseExpiry = new Date(row.leaseUntil);
    if (leaseExpiry > now) {
      return { available: false, leaseOwner: row.leaseOwner, leaseUntil: row.leaseUntil };
    }
  }

  return { available: true, leaseOwner: null, leaseUntil: row.leaseUntil };
}

export function isAppOnline(seenAt: string | null, now: Date, onlineWindowMs: number): boolean {
  if (!seenAt) return false;
  const seenDate = new Date(seenAt);
  return now.getTime() - seenDate.getTime() <= onlineWindowMs;
}
