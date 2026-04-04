import { describe, expect, it, vi } from "vitest";
import { SupabaseHeartbeatSource } from "@/lib/ai/data-sources/supabase-heartbeat-source";

describe("SupabaseHeartbeatSource", () => {
  it("does not create a checkpoint row when read-only lookup is requested", async () => {
    const upsertCheckpointRow = vi.fn();
    const source = new SupabaseHeartbeatSource({
      deps: {
        loadCheckpointRow: async () => null,
        upsertCheckpointRow,
      },
    });

    const checkpoint = await source.getCheckpoint("notifications", {
      createIfMissing: false,
    });

    expect(checkpoint.lastCapturedAt.toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(checkpoint.safetyOverlapSeconds).toBe(10);
    expect(upsertCheckpointRow).not.toHaveBeenCalled();
  });
});
