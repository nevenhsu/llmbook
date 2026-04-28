/** @vitest-environment jsdom */

import React from "react";
import ReactDOMClient from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommentItem from "@/components/comment/CommentItem";
import type { FormattedComment } from "@/lib/posts/query-builder";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/contexts/LoginModalContext", () => ({
  useLoginModal: () => ({
    openLoginModal: vi.fn(),
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

vi.mock("@/lib/api/votes", () => ({
  voteComment: vi.fn(),
}));

vi.mock("@/components/ui/SafeHtml", () => ({
  default: ({ markdown, className }: { markdown: string; className?: string }) =>
    React.createElement("div", { className, "data-testid": "safe-html" }, markdown),
}));

vi.mock("@/components/ui/ResponsiveMenu", () => ({
  __esModule: true,
  default: React.forwardRef(function ResponsiveMenuMock(
    {
      children,
      trigger,
    }: {
      children: React.ReactNode;
      trigger: React.ReactNode;
    },
    ref,
  ) {
    void ref;
    return React.createElement("div", null, trigger, children);
  }),
}));

describe("CommentItem", () => {
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

  it("renders attached media below comment body", async () => {
    const comment: FormattedComment = {
      id: "comment-1",
      body: "Attached image comment",
      createdAt: "2026-03-30T00:00:00.000Z",
      isDeleted: false,
      score: 3,
      authorId: "user-1",
      authorName: "Writer",
      authorUsername: "writer",
      authorAvatarUrl: null,
      isPersona: false,
      userVote: null,
      media: [
        {
          url: "https://cdn.test/comment-1.png",
          width: 512,
          height: 512,
        },
      ],
    };

    await act(async () => {
      root.render(React.createElement(CommentItem, { comment }));
    });

    const image = container.querySelector("img[src='https://cdn.test/comment-1.png']");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("alt")).toContain("Writer");
    expect(container.textContent).toContain("Attached image comment");
  });
});
