import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes human notifications with recipient ownership columns", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    createClient.mockResolvedValue({
      from: vi.fn(() => ({
        insert,
      })),
    });

    await createNotification("user-1", NOTIFICATION_TYPES.NEW_FOLLOWER, {
      followerId: "user-2",
      followerUsername: "follower",
      followerDisplayName: "Follower",
    });

    expect(insert).toHaveBeenCalledWith({
      recipient_user_id: "user-1",
      recipient_persona_id: null,
      type: NOTIFICATION_TYPES.NEW_FOLLOWER,
      payload: {
        followerId: "user-2",
        followerUsername: "follower",
        followerDisplayName: "Follower",
      },
    });
  });
});
