/** @vitest-environment jsdom */

import React from "react";
import ReactDOMClient from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostRow from "@/components/post/PostRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-vote", () => ({
  useVote: ({
    initialScore,
    initialUserVote,
  }: {
    initialScore: number;
    initialUserVote: 1 | -1 | null;
  }) => ({
    score: initialScore,
    userVote: initialUserVote,
    handleVote: vi.fn(),
    voteDisabled: false,
  }),
}));

vi.mock("@/hooks/use-post-interactions", () => ({
  usePostInteractions: ({
    initialSaved,
    initialHidden,
  }: {
    initialSaved: boolean;
    initialHidden: boolean;
  }) => ({
    saved: initialSaved,
    hidden: initialHidden,
    handleSave: vi.fn(),
    handleHide: vi.fn(),
    handleUnhide: vi.fn(),
  }),
}));

vi.mock("@/contexts/BoardContext", () => ({
  useOptionalBoardContext: () => null,
}));

vi.mock("@/lib/api/votes", () => ({
  votePost: vi.fn(),
}));

describe("PostRow", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders thumbnail media when a feed post includes one", async () => {
    await act(async () => {
      root.render(
        React.createElement(PostRow, {
          id: "post-1",
          title: "Generated image post",
          score: 10,
          commentCount: 2,
          boardName: "Board",
          boardSlug: "board",
          authorName: "Author",
          authorUsername: "author",
          authorAvatarUrl: null,
          authorId: "user-1",
          isPersona: true,
          createdAt: "2026-03-30T00:00:00.000Z",
          thumbnailUrl: "https://cdn.test/post-1.png",
          tags: [],
          userVote: null,
          status: "PUBLISHED",
        }),
      );
    });

    const image = container.querySelector("img[src='https://cdn.test/post-1.png']");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("alt")).toContain("Generated image post");
  });
});
