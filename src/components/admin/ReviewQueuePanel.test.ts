/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewQueueItem } from "@/lib/ai/review-queue/review-queue";
import type { ReviewQueueMetrics } from "@/lib/ai/observability/review-queue-metrics";
import ReviewQueuePanel from "./ReviewQueuePanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: toastMock,
}));

vi.mock("@/components/ui/Avatar", () => ({
  default: () => null,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const metrics: ReviewQueueMetrics = {
  windowHours: 24,
  resolvedTotal: 0,
  expiredCount: 0,
  expiredRatio: 0,
  avgExpiredWaitMs: null,
  pendingCount: 1,
};

function createItem(status: ReviewQueueItem["status"]): ReviewQueueItem {
  const now = new Date("2026-01-03T10:00:00.000Z");
  return {
    id: "review-1",
    taskId: "task-1",
    personaId: "persona-1",
    riskLevel: "HIGH",
    status,
    enqueueReasonCode: "safety_block",
    expiresAt: new Date("2026-01-04T10:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
    metadata: {
      userDisplayName: "Test User",
      userUsername: "test_user",
      generatedText: "generated response",
      safetyReasonCode: "safety_block",
    },
  };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ReviewQueuePanel", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("keeps approve/reject disabled with spinner while action is loading", async () => {
    const approveRequest = deferred<Response>();

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/admin/ai/review-queue/approve")) {
          return approveRequest.promise;
        }
        throw new Error(`unexpected fetch url: ${url}`);
      }),
    );

    await act(async () => {
      root.render(
        React.createElement(ReviewQueuePanel, {
          initialItems: [createItem("IN_REVIEW")],
          initialMetrics: metrics,
          initialPagination: { limit: 20, cursor: null, hasMore: false, nextCursor: null },
        }),
      );
    });

    const approveButton = findButton(container, "Approve");
    const rejectButton = findButton(container, "Reject");
    expect(approveButton).toBeDefined();
    expect(rejectButton).toBeDefined();

    await click(approveButton!);

    expect(findButton(container, "Approve")?.disabled).toBe(true);
    expect(findButton(container, "Reject")?.disabled).toBe(true);
    expect(container.querySelector(".loading-spinner")).not.toBeNull();

    approveRequest.resolve(
      Response.json({ item: { ...createItem("APPROVED"), decision: "APPROVE" } }, { status: 200 }),
    );
    await flush();

    expect(container.textContent).toContain("APPROVED");
  });

  it("preserves updated decision status locally until next list fetch", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/admin/ai/review-queue/reject")) {
        return Promise.resolve(
          Response.json(
            { item: { ...createItem("REJECTED"), decision: "REJECT" } },
            { status: 200 },
          ),
        );
      }
      if (url.startsWith("/api/admin/ai/review-queue?")) {
        return Promise.resolve(
          Response.json(
            {
              items: [createItem("IN_REVIEW")],
              metrics,
              pagination: { limit: 20, cursor: null, hasMore: false, nextCursor: null },
            },
            { status: 200 },
          ),
        );
      }
      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        React.createElement(ReviewQueuePanel, {
          initialItems: [createItem("IN_REVIEW")],
          initialMetrics: metrics,
          initialPagination: { limit: 20, cursor: null, hasMore: false, nextCursor: null },
        }),
      );
    });

    await click(findButton(container, "Reject")!);
    await flush();

    expect(container.textContent).toContain("REJECTED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/admin/ai/review-queue/reject");

    await click(findButton(container, "Refresh")!);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/admin/ai/review-queue?");
    expect(container.textContent).toContain("IN_REVIEW");
  });

  it("requests next/previous pages with expected cursor query", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("cursor=2026-01-03T10%3A00%3A00.000Z")) {
        return Promise.resolve(
          Response.json(
            {
              items: [{ ...createItem("IN_REVIEW"), id: "review-2", taskId: "task-2" }],
              metrics,
              pagination: {
                limit: 1,
                cursor: "2026-01-03T10:00:00.000Z",
                hasMore: false,
                nextCursor: null,
              },
            },
            { status: 200 },
          ),
        );
      }

      if (url === "/api/admin/ai/review-queue?status=PENDING,IN_REVIEW&limit=1") {
        return Promise.resolve(
          Response.json(
            {
              items: [createItem("PENDING")],
              metrics,
              pagination: {
                limit: 1,
                cursor: null,
                hasMore: true,
                nextCursor: "2026-01-03T10:00:00.000Z",
              },
            },
            { status: 200 },
          ),
        );
      }

      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        React.createElement(ReviewQueuePanel, {
          initialItems: [createItem("PENDING")],
          initialMetrics: metrics,
          initialPagination: {
            limit: 1,
            cursor: null,
            hasMore: true,
            nextCursor: "2026-01-03T10:00:00.000Z",
          },
        }),
      );
    });

    expect(findButton(container, "Previous")?.disabled).toBe(true);

    await click(findButton(container, "Next")!);
    await flush();

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cursor=2026-01-03T10%3A00%3A00.000Z");
    expect(findButton(container, "Previous")?.disabled).toBe(false);

    await click(findButton(container, "Previous")!);
    await flush();

    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "/api/admin/ai/review-queue?status=PENDING,IN_REVIEW&limit=1",
    );
  });
});
