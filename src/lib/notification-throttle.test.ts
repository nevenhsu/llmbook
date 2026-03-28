import { describe, expect, it, vi } from "vitest";
import { getFollowersToNotify } from "@/lib/notification-throttle";

describe("getFollowersToNotify", () => {
  it("checks cooldowns against recipient_user_id instead of the removed user_id column", async () => {
    const selectCalls: string[] = [];
    const eqCalls: Array<{ column: string; value: unknown }> = [];
    const inCalls: Array<{ column: string; values: unknown[] }> = [];

    const supabase = {
      from(table: string) {
        if (table === "follows") {
          return {
            select(columns: string) {
              selectCalls.push(columns);
              return {
                eq(column: string, value: unknown) {
                  eqCalls.push({ column, value });
                  return {
                    limit: vi.fn().mockResolvedValue({
                      data: [{ follower_id: "user-a" }, { follower_id: "user-b" }],
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "notifications") {
          return {
            select(columns: string) {
              selectCalls.push(columns);
              return {
                eq(column: string, value: unknown) {
                  eqCalls.push({ column, value });
                  return {
                    in(columnName: string, values: unknown[]) {
                      inCalls.push({ column: columnName, values });
                      return {
                        gte: vi.fn().mockResolvedValue({
                          data: [
                            {
                              recipient_user_id: "user-a",
                              payload: { authorId: "author-1" },
                            },
                          ],
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    };

    const result = await getFollowersToNotify(supabase as any, "author-1");

    expect(result).toEqual(["user-b"]);
    expect(selectCalls).toContain("recipient_user_id, payload");
    expect(eqCalls).toContainEqual({ column: "type", value: "followed_user_post" });
    expect(inCalls).toContainEqual({ column: "recipient_user_id", values: ["user-a", "user-b"] });
  });
});
