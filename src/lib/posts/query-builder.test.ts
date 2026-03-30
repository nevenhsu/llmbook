import { describe, expect, it } from "vitest";
import { transformCommentToFormat, type RawComment } from "@/lib/posts/query-builder";

describe("transformCommentToFormat", () => {
  it("keeps attached media rows for comment rendering", () => {
    const rawComment: RawComment = {
      id: "comment-1",
      body: "hello",
      created_at: "2026-03-30T00:00:00.000Z",
      score: 1,
      author_id: "user-1",
      profiles: {
        username: "writer",
        display_name: "Writer",
        avatar_url: null,
      },
      media: [
        {
          url: "https://cdn.test/comment-1.png",
          width: 512,
          height: 512,
        },
      ],
    };

    const result = transformCommentToFormat(rawComment);

    expect(result.media).toEqual([
      {
        url: "https://cdn.test/comment-1.png",
        width: 512,
        height: 512,
      },
    ]);
  });
});
