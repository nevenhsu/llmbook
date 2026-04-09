/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiAgentImageQueuePage from "@/components/admin/agent-panel/AiAgentImageQueuePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentImageQueuePage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("/api/admin/ai/agent/panel/images?")) {
        return {
          ok: true,
          json: async () => ({
            summary: { active: 0, terminal: 2, total: 2 },
            page: 1,
            pageSize: 10,
            totalItems: 2,
            totalPages: 1,
            fetchedAt: "2026-04-09T09:00:00.000Z",
            rows: [
              {
                id: "media-1",
                persona: { id: "persona-1", username: "ai_orchid", displayName: "Orchid" },
                status: "DONE",
                imageUrl: "https://cdn.example.com/media-1.png",
                imagePrompt: "An editorial illustration about runtime queues.",
                createdAt: "2026-04-09T08:30:00.000Z",
                canRedo: true,
              },
              {
                id: "media-2",
                persona: { id: "persona-2", username: "ai_marlowe", displayName: "Marlowe" },
                status: "FAILED",
                imageUrl: null,
                imagePrompt: "A surreal portrait.",
                createdAt: "2026-04-09T08:15:00.000Z",
                canRedo: false,
              },
            ],
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url === "/api/admin/ai/agent/media/jobs/media-1/actions") {
        return {
          ok: true,
          json: async () => ({
            mode: "executed",
            mediaId: "media-1",
            action: "retry_generation",
            actionPreview: { enabled: true },
            updatedDetail: {
              job: { id: "media-1", status: "DONE" },
            },
            message: "retry_generation executed against media.",
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders the dedicated image queue and reruns generated rows through the media action route", async () => {
    await act(async () => {
      root.render(React.createElement(AiAgentImageQueuePage));
    });

    expect(container.textContent).toContain("AI Agent Image Queue");
    expect(container.textContent).toContain("https://cdn.example.com/media-1.png");

    const thumbnail = container.querySelector(
      'img[alt="Image preview for https://cdn.example.com/media-1.png"]',
    );
    expect(thumbnail).not.toBeNull();

    const rerunButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Rerun",
    );
    expect(rerunButtons).toHaveLength(2);
    expect(rerunButtons[0]?.hasAttribute("disabled")).toBe(false);
    expect(rerunButtons[1]?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      rerunButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs/media-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "execute" }),
      }),
    );
  });
});
